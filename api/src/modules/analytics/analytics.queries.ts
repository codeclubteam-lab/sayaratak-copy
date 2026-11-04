import { and, between, eq, inArray, sql, sum } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import type { DayRange } from "~/shared/time/khartoum"

import { events, eventsMonthly } from "./analytics.tables"

// The counters of a listing or business page. Banner types are left out.
const PAGE_TYPES = ["view", "phone_click", "whatsapp_click", "share"] as const

/** Removes a target's counters, the daily rows and the months they were rolled into. */
export async function deleteOfTarget(ex: Executor, targetId: string) {
  await ex.delete(events).where(eq(events.targetId, targetId))
  await ex.delete(eventsMonthly).where(eq(eventsMonthly.targetId, targetId))
}

/** Adds one to the counter of the target, day and type; the first one of a day creates the row. */
export function bumpEvent(
  ex: Executor,
  event: Pick<typeof events.$inferInsert, "day" | "targetId" | "type">
) {
  return ex
    .insert(events)
    .values({ ...event, count: 1 })
    .onConflictDoUpdate({
      target: [events.targetId, events.day, events.type],
      set: { count: sql`${events.count} + 1` },
    })
}

/** Page counters per day and type for these targets (`null`: all of them) inside the days. */
export function listDailyCounts(
  ex: Executor,
  targetIds: string[] | null,
  days: DayRange
) {
  return ex
    .select({
      day: events.day,
      type: events.type,
      count: sum(events.count).mapWith(Number),
    })
    .from(events)
    .where(pageEvents(targetIds, days))
    .groupBy(events.day, events.type)
}

/** Page counters per target and type for these targets inside the days. */
export function listTargetCounts(
  ex: Executor,
  targetIds: string[],
  days: DayRange
) {
  return ex
    .select({
      targetId: events.targetId,
      type: events.type,
      count: sum(events.count).mapWith(Number),
    })
    .from(events)
    .where(pageEvents(targetIds, days))
    .groupBy(events.targetId, events.type)
}

function pageEvents(targetIds: string[] | null, days: DayRange) {
  return and(
    between(events.day, days.first, days.last),
    inArray(events.type, [...PAGE_TYPES]),
    targetIds ? inArray(events.targetId, targetIds) : undefined
  )
}
