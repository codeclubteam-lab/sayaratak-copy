import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"

import { env } from "~/env"
import { backupFiles } from "~/shared/storage/r2"

import { takeBackup } from "./admin-backups.dump.service"

// The 8.11 check against the owner's real R2 bucket. Runs only with `R2_LIVE=1` and the four
// `R2_*` values set. Everything it stores is deleted at the end.
const LIVE =
  Bun.env.R2_LIVE === "1" && Boolean(env.R2_BUCKET && env.R2_SECRET_ACCESS_KEY)
setDefaultTimeout(120_000)

describe.skipIf(!LIVE)("live R2 bucket", () => {
  test("stores, reads back and deletes an object", async () => {
    const key = `live-check/${crypto.randomUUID()}.txt`
    const file = `${tmpdir()}/${crypto.randomUUID()}.txt`
    try {
      const bytes = await backupFiles.put(key, new Blob(["hello r2"]).stream())
      expect(bytes).toBe(8)
      await backupFiles.download(key, file)
      expect(await Bun.file(file).text()).toBe("hello r2")
      await backupFiles.remove(key)
      await expect(backupFiles.download(key, file)).rejects.toThrow()
    } finally {
      await backupFiles.remove(key)
      await rm(file, { force: true })
    }
  })

  test("a real dump goes into the bucket and comes back as a custom-format file", async () => {
    const backup = await takeBackup({ type: "manual" })
    const key = `backups/${backup.id}.dump`
    const file = `${tmpdir()}/${backup.id}.dump`
    try {
      expect(backup.status).toBe("ready")
      await backupFiles.download(key, file)
      // pg_dump's custom format starts with "PGDMP".
      expect(await Bun.file(file).slice(0, 5).text()).toBe("PGDMP")
      expect(Bun.file(file).size).toBeGreaterThan(1000)
    } finally {
      await backupFiles.remove(key)
      await rm(file, { force: true })
    }
  })
})
