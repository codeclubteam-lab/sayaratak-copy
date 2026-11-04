import { beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test"
import { backupSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"

import { callAs } from "../../../tests/banners"
import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import { backups } from "./admin-backups.tables"

// Each dump and restore starts a Docker container, about a second apiece.
setDefaultTimeout(60_000)
beforeEach(resetDb)

describe("POST /admin/backups", () => {
  test("stores a dump and answers a ready backup with its size, and the audit row", async () => {
    const admin = await signIn("admin")
    const res = await callAs(admin)("POST", "/admin/backups")
    expect(res.status).toBe(200)
    const backup = await expectSchema(res, backupSchema)
    expect(backup).toMatchObject({ type: "manual", status: "ready" })
    expect(backup.sizeMb).toBeGreaterThan(0)
    const [row] = await db
      .select()
      .from(backups)
      .where(eq(backups.id, backup.id))
    expect(row?.objectKey).toBe(`backups/${backup.id}.dump`)
    expect(row?.bytes).toBeGreaterThan(0)
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, backup.id))
    expect(audit.map((a) => a.action)).toEqual(["backup.create"])
  })

  test("a dump that fails is a 500, a `failed` row and no file", async () => {
    const admin = await signIn("admin")
    // `false` ignores its arguments and exits 1, standing in for a refused pg_dump.
    env.PG_CLIENT_CMD = "false"
    try {
      const res = await callAs(admin)("POST", "/admin/backups")
      expect(res.status).toBe(500)
    } finally {
      env.PG_CLIENT_CMD = Bun.env.PG_CLIENT_CMD
    }
    const failed = await db
      .select()
      .from(backups)
      .where(eq(backups.status, "failed"))
    expect(failed.length).toBe(1)
    expect(failed[0]?.objectKey).toBeNull()
  })
})
