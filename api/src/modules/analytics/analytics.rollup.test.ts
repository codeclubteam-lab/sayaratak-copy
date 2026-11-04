import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { asc } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import { events, eventsMonthly } from "./analytics.tables"
import * as queries from "./analytics.rollup.queries"
import { rollUpOldDays } from "./analytics.rollup.service"

// In November 2026 the 13 months kept daily are 2025-11 to 2026-11.
const NOW = new Date("2026-11-03T10:00:00Z")

beforeEach(async () => {
  await resetDb()
  await db.delete(events)
  spyOn(clock, "now").mockReturnValue(NOW)
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

// `with` carries the optional type, so the helper stays within three parameters.
const day = (
  target: string,
  date: string,
  count: number | { count: number; type: "view" | "phone_click" }
) => {
  const { count: n, type } =
    typeof count === "number" ? { count, type: "view" as const } : count
  return db
    .insert(events)
    .values({ targetId: target, day: date, type, count: n })
}

const monthly = () =>
  db
    .select()
    .from(eventsMonthly)
    .orderBy(asc(eventsMonthly.targetId), asc(eventsMonthly.month))

describe("rollUpOldDays (prune job, monthly counters)", () => {
  test("adds the days of months older than 13 months into one row per month and keeps recent days", async () => {
    await day("l1", "2025-10-03", 4)
    await day("l1", "2025-10-30", 6)
    await day("l1", "2025-09-15", 5)
    await day("l2", "2025-10-03", 2)
    // The first day that stays daily, and a recent one.
    await day("l1", "2025-11-01", 7)
    await day("l1", "2026-11-02", 9)

    expect(await rollUpOldDays()).toBe(4)

    expect(await monthly()).toEqual([
      { targetId: "l1", month: "2025-09-01", type: "view", count: 5 },
      { targetId: "l1", month: "2025-10-01", type: "view", count: 10 },
      { targetId: "l2", month: "2025-10-01", type: "view", count: 2 },
    ])
    expect(
      (await db.select().from(events)).map((row) => row.day).sort()
    ).toEqual(["2025-11-01", "2026-11-02"])
  })

  test("keeps each type apart", async () => {
    await day("l1", "2025-01-10", 3)
    await day("l1", "2025-01-11", { count: 2, type: "phone_click" })
    await rollUpOldDays()
    expect(
      (await monthly()).map((row) => [row.type, row.count]).sort()
    ).toEqual([
      ["phone_click", 2],
      ["view", 3],
    ])
  })

  test("running it twice gives the same result", async () => {
    await day("l1", "2025-03-03", 4)
    expect(await rollUpOldDays()).toBe(1)
    const after = await monthly()
    expect(await rollUpOldDays()).toBe(0)
    expect(await monthly()).toEqual(after)
  })

  test("adds to a month that already has a row", async () => {
    await day("l1", "2025-03-03", 4)
    await rollUpOldDays()
    await day("l1", "2025-03-04", 1)
    await rollUpOldDays()
    expect((await monthly())[0]?.count).toBe(5)
  })

  test("a crash after the first batch loses and repeats nothing", async () => {
    for (let d = 1; d <= 5; d++) await day("l1", `2025-02-0${d}`, d)
    const crash = failOnCall(queries, "addMonthly", 2)

    await expect(rollUpOldDays(2)).rejects.toThrow("crashed")
    // The first batch (the two oldest days, 1 + 2) is in the month; the second rolled back whole.
    expect((await monthly())[0]?.count).toBe(3)
    expect(await db.$count(events)).toBe(3)

    crash.mockRestore()
    expect(await rollUpOldDays(2)).toBe(3)
    expect(await monthly()).toEqual([
      { targetId: "l1", month: "2025-02-01", type: "view", count: 15 },
    ])
    expect(await db.$count(events)).toBe(0)
  })
})
