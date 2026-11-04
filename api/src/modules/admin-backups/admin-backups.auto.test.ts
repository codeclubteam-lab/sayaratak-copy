import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  spyOn,
  test,
} from "bun:test"
import { env } from "~/env"
import { settings } from "~/modules/content/content.tables"
import { db } from "~/shared/db/client"
import { backupFiles } from "~/shared/storage/r2"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import {
  KEEP_AUTO,
  autoBackup,
  pruneAutoBackups,
} from "./admin-backups.auto.service"
import { backups } from "./admin-backups.tables"

// Each dump starts a Docker container, about a second apiece.
setDefaultTimeout(60_000)
beforeEach(async () => {
  await resetDb()
  // The seed holds backups of its own; these tests count the job's.
  await db.delete(backups)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

// 2026-11-06 is a Friday, so 07 is a Saturday (checked below).
const FRIDAY = "2026-11-06T12:00:00Z"
const SATURDAY = "2026-11-07T12:00:00Z"
const at = (iso: string) =>
  spyOn(clock, "now").mockImplementation(() => new Date(iso))
const schedule = (backupSchedule: "daily" | "weekly" | "off") =>
  db.update(settings).set({ backupSchedule })
const rows = () => db.select().from(backups)
const lastAuto = async () =>
  (await db.select().from(settings))[0]?.lastAutoBackupAt

test("the dates used below fall on a Friday and a Saturday", () => {
  expect(new Date(FRIDAY).getUTCDay()).toBe(5)
  expect(new Date(SATURDAY).getUTCDay()).toBe(6)
})

describe("autoBackup (auto-backup job)", () => {
  test("daily: takes a ready automatic backup and stamps the time; a second run the same day does nothing", async () => {
    await schedule("daily")
    at(FRIDAY)
    expect(await autoBackup()).toBe(1)
    const [backup] = await rows()
    expect(backup).toMatchObject({ type: "auto", status: "ready" })
    expect(backup?.createdBy).toBeNull()
    expect(await lastAuto()).toEqual(new Date(FRIDAY))

    expect(await autoBackup()).toBe(0)
    expect(await rows()).toHaveLength(1)
  })

  test("weekly: only on Friday", async () => {
    await schedule("weekly")
    at(SATURDAY)
    expect(await autoBackup()).toBe(0)
    expect(await rows()).toHaveLength(0)

    at(FRIDAY)
    expect(await autoBackup()).toBe(1)
    expect(await rows()).toHaveLength(1)
  })

  test("off: never", async () => {
    await schedule("off")
    at(FRIDAY)
    expect(await autoBackup()).toBe(0)
    expect(await rows()).toHaveLength(0)
    expect(await lastAuto()).toBeNull()
  })

  test("a dump that fails throws and leaves no stamp; the next run takes the backup", async () => {
    await schedule("daily")
    at(FRIDAY)
    // `false` ignores its arguments and exits 1, standing in for a refused pg_dump.
    env.PG_CLIENT_CMD = "false"
    try {
      await expect(autoBackup()).rejects.toThrow()
    } finally {
      env.PG_CLIENT_CMD = Bun.env.PG_CLIENT_CMD
    }
    expect((await rows()).map((row) => row.status)).toEqual(["failed"])
    expect(await lastAuto()).toBeNull()

    expect(await autoBackup()).toBe(1)
    expect((await rows()).map((row) => row.status).sort()).toEqual([
      "failed",
      "ready",
    ])
  })
})

describe("pruneAutoBackups", () => {
  // `count` ready backups of `type`, oldest first, each with a file in the store.
  async function stock(type: "auto" | "manual", count: number, from: number) {
    const made = []
    for (let i = 0; i < count; i += 1) {
      const id = `bk-${type}-${i}`
      const objectKey = `backups/${id}.dump`
      await backupFiles.put(objectKey, new Blob(["dump"]).stream())
      made.push({
        id,
        type,
        status: "ready" as const,
        objectKey,
        bytes: 4,
        createdAt: new Date(Date.UTC(2026, 0, from + i)),
      })
    }
    await db.insert(backups).values(made)
    return made
  }
  const gone = (key: string) =>
    expect(
      backupFiles.download(key, `/tmp/${Bun.randomUUIDv7()}`)
    ).rejects.toThrow()

  test("keeps the newest 14 automatic backups, deletes older ones with their files, never touches manual ones", async () => {
    // The manual ones are the oldest of all and still stay.
    const manual = await stock("manual", 2, 1)
    const auto = await stock("auto", KEEP_AUTO + 2, 10)

    expect(await pruneAutoBackups()).toBe(2)
    const left = (await rows()).map((row) => row.id)
    expect(left).toHaveLength(KEEP_AUTO + 2)
    expect(left).not.toContain(auto[0]?.id ?? "")
    expect(left).not.toContain(auto[1]?.id ?? "")
    expect(left).toContain(manual[0]?.id ?? "")
    await gone(auto[0]?.objectKey ?? "")
    await gone(auto[1]?.objectKey ?? "")
    await backupFiles.download(
      auto[2]?.objectKey ?? "",
      `/tmp/${Bun.randomUUIDv7()}`
    )

    expect(await pruneAutoBackups()).toBe(0)
  })

  test("a failed or running backup is not counted", async () => {
    await stock("auto", KEEP_AUTO, 10)
    await db.insert(backups).values({
      id: "bk-failed",
      type: "auto",
      status: "failed",
      createdAt: new Date(Date.UTC(2026, 5, 1)),
    })
    expect(await pruneAutoBackups()).toBe(0)
    expect(await rows()).toHaveLength(KEEP_AUTO + 1)
  })

  test("a crash while deleting the first file keeps its row; the next run finishes", async () => {
    const auto = await stock("auto", KEEP_AUTO + 2, 10)
    const crash = failOnCall(backupFiles, "remove", 1)
    await expect(pruneAutoBackups()).rejects.toThrow("crashed")
    crash.mockRestore()
    expect(await rows()).toHaveLength(KEEP_AUTO + 2)

    expect(await pruneAutoBackups()).toBe(2)
    expect(await rows()).toHaveLength(KEEP_AUTO)
    await gone(auto[0]?.objectKey ?? "")
  })
})
