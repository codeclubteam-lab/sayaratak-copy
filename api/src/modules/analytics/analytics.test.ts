import { beforeEach, describe, expect, test } from "bun:test"
import { eq, sql } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { events } from "./analytics.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("event table", () => {
  test("holds the mock's counts per target, one row per day and type", async () => {
    const target = seeded.events[0]?.targetId ?? ""
    const expected = seeded.events
      .filter((e) => e.targetId === target)
      .reduce((sum, e) => sum + e.counts.view, 0)
    const [row] = await db
      .select({ views: sql<number>`sum(${events.count})::int` })
      .from(events)
      .where(sql`${events.targetId} = ${target} and ${events.type} = 'view'`)
    expect(row?.views).toBe(expected)
  })

  test("refuses a zero count, since no events is no row", async () => {
    const target = seeded.events[0]?.targetId ?? ""
    const error = await db
      .update(events)
      .set({ count: 0 })
      .where(eq(events.targetId, target))
      .catch((error) => error)
    expect(error.cause.constraint).toBe("events_count_positive")
  })
})
