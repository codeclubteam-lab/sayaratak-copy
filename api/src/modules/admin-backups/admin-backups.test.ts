import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { backups } from "./admin-backups.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("backup table", () => {
  test("holds the mock's backups with their size", async () => {
    const rows = await db
      .select({ id: backups.id, bytes: backups.bytes })
      .from(backups)
    expect(rows.length).toBe(seeded.backups.length)
    expect(rows.find((r) => r.id === "bk-1")?.bytes).toBe(40 * 1024 * 1024)
  })

  test("refuses a ready backup with no file", async () => {
    const error = await db
      .update(backups)
      .set({ objectKey: null })
      .where(eq(backups.id, "bk-1"))
      .catch((error) => error)
    expect(error.cause.constraint).toBe("backups_ready_has_file")
  })
})
