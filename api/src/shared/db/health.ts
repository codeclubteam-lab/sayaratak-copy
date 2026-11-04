import { sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "./client"

const DB_ANSWER_MS = 2000

const journalSchema = z.object({
  entries: z.array(z.object({ when: z.number() })),
})

let expected: number | undefined

/** The newest migration this build ships, from drizzle's journal (the image carries `drizzle/`). */
async function newestShippedMigration() {
  if (expected === undefined) {
    const file = Bun.file(
      new URL("../../../drizzle/meta/_journal.json", import.meta.url)
    )
    const { entries } = journalSchema.parse(await file.json())
    expected = Math.max(0, ...entries.map((entry) => entry.when))
  }
  return expected
}

/** True when the database answers a trivial query within two seconds. */
export async function databaseAnswers() {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("db_timeout")), DB_ANSWER_MS)
      }),
    ])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Current means every migration this build ships is applied. A newer database is fine: an older image rolled back onto an expand-only migration (A3) is still ready. */
export function migrationsCurrent(applied: number | null, shipped: number) {
  return applied !== null && applied >= shipped
}

export async function migrationsApplied() {
  const [row] = await db.execute<{ latest: string | null }>(
    sql`select max(created_at) as latest from drizzle.__drizzle_migrations`
  )
  return row?.latest == null ? null : Number(row.latest)
}

export async function databaseIsMigrated() {
  try {
    return migrationsCurrent(
      await migrationsApplied(),
      await newestShippedMigration()
    )
  } catch {
    return false
  }
}

/** Closes the pool (shutdown, 10.4). */
export function closeDb() {
  return db.$client.close()
}
