import { transaction } from "~/shared/db/tx"
import { BATCH_SIZE, drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"
import { monthOf } from "~/shared/time/khartoum"

import * as q from "./analytics.rollup.queries"

// Owner, 9.3 (O3): daily counters are kept 13 months (this month and the 12 before it).
const MONTHS_KEPT = 13

/**
 * Adds the daily counters of months older than 13 months into one row per target, month and type,
 * then deletes the daily rows (A10, `prune`). Whole months only, so a month's row is complete
 * the first time it is written. Each batch is one transaction, so a crash loses and repeats
 * nothing. Answers how many daily rows it rolled up.
 */
export function rollUpOldDays(size = BATCH_SIZE) {
  const beforeDay = firstDayKept(clock.now())
  return drain(
    (limit) =>
      transaction(async (tx) => {
        const old = await q.deleteOldDays(tx, { beforeDay, size: limit })
        await q.addMonthly(tx, sumPerMonth(old))
        return old.length
      }),
    size
  )
}

/** The first day that stays daily. Example: in November 2026 the 13 months are 2025-11 to 2026-11, so `"2025-11-01"`. */
function firstDayKept(now: Date) {
  const [year = 0, month = 1] = monthOf(now).split("-").map(Number)
  const first = year * 12 + (month - 1) - (MONTHS_KEPT - 1)
  const mm = String((first % 12) + 1).padStart(2, "0")
  return `${Math.floor(first / 12)}-${mm}-01`
}

function sumPerMonth(days: Awaited<ReturnType<typeof q.deleteOldDays>>) {
  const sums = new Map<string, q.MonthlyCount>()
  for (const day of days) {
    const month = `${day.day.slice(0, 7)}-01`
    const key = `${day.target_id}|${month}|${day.type}`
    const sum = sums.get(key)
    if (sum) sum.count += day.count
    else
      sums.set(key, {
        month,
        targetId: day.target_id,
        type: day.type,
        count: day.count,
      })
  }
  return [...sums.values()]
}
