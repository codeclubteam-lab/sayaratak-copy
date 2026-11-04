import { sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { events, eventsMonthly } from "./analytics.tables"

type OldDay = {
  target_id: string
  day: string
  type: (typeof events.$inferSelect)["type"]
  count: number
}
export type MonthlyCount = typeof eventsMonthly.$inferInsert

/**
 * Deletes up to `size` of the oldest daily rows before `beforeDay` and answers them, so the caller
 * can add them into months in the same transaction. Rows another transaction holds are left.
 */
export async function deleteOldDays(
  ex: Executor,
  batch: { beforeDay: string; size: number }
) {
  return await ex.execute<OldDay>(
    sql`delete from ${events} where ctid in (select ctid from ${events} where ${events.day} < ${batch.beforeDay} order by ${events.day} limit ${batch.size} for update skip locked) returning target_id, to_char(day, 'YYYY-MM-DD') as day, type, count`
  )
}

/** Adds these counts to their month's row; the first one of a month creates it. */
export async function addMonthly(ex: Executor, rows: MonthlyCount[]) {
  if (rows.length === 0) return
  await ex
    .insert(eventsMonthly)
    .values(rows)
    .onConflictDoUpdate({
      target: [eventsMonthly.targetId, eventsMonthly.month, eventsMonthly.type],
      set: { count: sql`${eventsMonthly.count} + excluded.count` },
    })
}
