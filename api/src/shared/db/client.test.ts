import { expect, test } from "bun:test"
import { sql } from "drizzle-orm"
import { db } from "~/shared/db/client"
import journal from "../../../drizzle/meta/_journal.json"

test("test database has every migration applied", async () => {
  const rows = await db.execute<{ hash: string }>(
    sql`select hash from drizzle.__drizzle_migrations`
  )
  expect(rows.length).toBe(journal.entries.length)
})
