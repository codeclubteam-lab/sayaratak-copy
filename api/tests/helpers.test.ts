import { afterAll, expect, test } from "bun:test"
import { sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"

import { expectSchema, req, resetDb } from "./helpers"

// A scratch table, so the test does not wait for Phase 2's tables.
const TABLE = sql.identifier("helpers_test_rows")

afterAll(async () => {
  await db.execute(sql`drop table if exists ${TABLE}`)
})

test("resetDb empties every table", async () => {
  await db.execute(sql`create table if not exists ${TABLE} (id int)`)
  await db.execute(sql`insert into ${TABLE} values (1), (2)`)
  await resetDb()
  const rows = await db.execute(sql`select id from ${TABLE}`)
  expect(rows.length).toBe(0)
})

test("expectSchema returns the parsed body and fails on a mismatch", async () => {
  const body = await expectSchema(
    await req("/nope"),
    z.object({ code: z.string() })
  )
  expect(body.code).toBe("not_found")
  const mismatch = expectSchema(
    await req("/nope"),
    z.object({ code: z.number() })
  )
  expect(await mismatch.catch((error) => error)).toBeInstanceOf(Error)
})
