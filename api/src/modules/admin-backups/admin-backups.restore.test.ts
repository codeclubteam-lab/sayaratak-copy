import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { SQL } from "bun"

import { apiIsRunning, holdRunningLock } from "~/shared/db/running-lock"

import { runMigrations } from "../../../scripts/migrate"

// The restore drops and makes every table and type again, which breaks the prepared statements of
// every pool that was open, so it never runs against the test database the other tests share.
// These tests restore a scratch database, through the commands, as an operator would.
setDefaultTimeout(120_000)

const SCRATCH = "sayaratak_restore_test"
const mainUrl = process.env.TEST_DATABASE_URL ?? ""
const scratchUrl = mainUrl.replace(/\/[^/]*$/, `/${SCRATCH}`)

async function sql(url: string, query: string) {
  const client = new SQL({ url, max: 1 })
  try {
    return await client.unsafe(query)
  } finally {
    await client.close()
  }
}

async function run(script: string, args: string[], typed = "") {
  const proc = Bun.spawn(["bun", `scripts/${script}`, ...args], {
    env: { ...process.env, DATABASE_URL: scratchUrl },
    stdin: new Blob([typed]),
    stdout: "pipe",
    stderr: "pipe",
  })
  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { code, out, err }
}

const vehicleTypes = async () =>
  Number((await sql(scratchUrl, "select count(*) from vehicle_types"))[0].count)
const backupIds = async () =>
  (await sql(scratchUrl, "select id from backups")).map(
    (row: { id: string }) => row.id
  )

async function takeScratchBackup() {
  const taken = await run("db-backup.ts", [])
  expect(taken.code).toBe(0)
  return taken.out.match(/Backup (bk-\w+) stored/)?.[1] ?? ""
}

beforeAll(async () => {
  await sql(mainUrl, `drop database if exists ${SCRATCH} with (force)`)
  await sql(mainUrl, `create database ${SCRATCH}`)
  await runMigrations(scratchUrl)
  expect((await run("bootstrap.ts", [])).code).toBe(0)
})

afterAll(() => sql(mainUrl, `drop database if exists ${SCRATCH} with (force)`))

describe("scripts/db-restore.ts", () => {
  test("puts the data back, keeps the history and saves the state before", async () => {
    const id = await takeScratchBackup()
    const had = await vehicleTypes()
    expect(had).toBeGreaterThan(0)
    await sql(scratchUrl, "delete from vehicle_types")

    const done = await run("db-restore.ts", [id], "RESTORE\n")

    expect(done.code).toBe(0)
    expect(await vehicleTypes()).toBe(had)
    const safety = done.out.match(/saved as backup (bk-\w+)/)?.[1]
    expect(await backupIds()).toEqual(expect.arrayContaining([id, safety]))
    const audit = await sql(
      scratchUrl,
      `select action from audit_log where target_id = '${id}'`
    )
    expect(audit.map((row: { action: string }) => row.action)).toEqual([
      "backup.restore",
    ])
  })

  test("does nothing unless the typed word is RESTORE", async () => {
    const id = await takeScratchBackup()
    await sql(scratchUrl, "delete from vehicle_types")
    const done = await run("db-restore.ts", [id], "restore\n")
    expect(done.code).toBe(1)
    expect(done.out).toContain("Cancelled")
    expect(await vehicleTypes()).toBe(0)
  })

  test("refuses while an API process is up, unless --force", async () => {
    // The test before emptied the table; the bootstrap puts the rows back.
    expect((await run("bootstrap.ts", [])).code).toBe(0)
    const id = await takeScratchBackup()
    await sql(scratchUrl, "delete from vehicle_types")
    const api = await holdRunningLock(scratchUrl)
    try {
      const refused = await run("db-restore.ts", [id], "RESTORE\n")
      expect(refused.code).not.toBe(0)
      expect(refused.err).toContain("API process is running")
      expect(await vehicleTypes()).toBe(0)
      const forced = await run("db-restore.ts", [id, "--force"], "RESTORE\n")
      expect(forced.code).toBe(0)
    } finally {
      await api.close()
    }
    expect(await vehicleTypes()).toBeGreaterThan(0)
  })

  test("stops with nothing touched for a missing file, a failed backup or an unknown id", async () => {
    await sql(
      scratchUrl,
      `insert into backups (id, type, status, object_key, bytes, created_at)
       values ('bk-nofile', 'manual', 'ready', 'backups/bk-nofile.dump', 10, now()),
              ('bk-failed', 'manual', 'failed', null, null, now())`
    )
    await sql(scratchUrl, "delete from vehicle_types")
    const before = await backupIds()
    for (const id of ["bk-nofile", "bk-failed", "bk-unknown"]) {
      const refused = await run("db-restore.ts", [id, "--force"], "RESTORE\n")
      expect(refused.code).not.toBe(0)
    }
    expect(await vehicleTypes()).toBe(0)
    expect(await backupIds()).toEqual(before)
  })
})

describe("the API lock", () => {
  test("is taken by an API process and gone when it closes", async () => {
    expect(await apiIsRunning()).toBe(false)
    const api = await holdRunningLock()
    expect(await apiIsRunning()).toBe(true)
    await api.close()
    expect(await apiIsRunning()).toBe(false)
  })
})
