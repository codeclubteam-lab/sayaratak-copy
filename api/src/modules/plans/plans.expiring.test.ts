import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { eq } from "drizzle-orm"

import { notifications } from "~/modules/notifications/notifications.tables"
import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./plans.expiry.queries"
import { notifyExpiring } from "./plans.expiry.service"
import { subscriptions } from "./plans.tables"

// Seed: the dealership, the workshop and a person are on paid plans, the mechanic on a free one;
// all end together.
const DAY_MS = 86_400_000
const PAID = [DEMO_IDS.dealership, DEMO_IDS.workshop, DEMO_IDS.user]

let endsAt = new Date()

beforeEach(async () => {
  await resetDb()
  // The seed holds notices of its own; these tests count the job's.
  await db.delete(notifications)
  const [first] = await db.select().from(subscriptions)
  if (!first) throw new Error("the seed has subscriptions")
  endsAt = first.endsAt
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

const daysBeforeEnd = (days: number) =>
  spyOn(clock, "now").mockReturnValue(
    new Date(endsAt.getTime() - days * DAY_MS)
  )
const notices = () =>
  db
    .select()
    .from(notifications)
    .where(eq(notifications.type, "subscription_expiring"))

describe("notifyExpiring (subscription-expiring job)", () => {
  test("tells the owners of paid plans that end within three days, and not the free one", async () => {
    daysBeforeEnd(2)
    expect(await notifyExpiring()).toBe(3)

    const rows = await notices()
    expect(rows.map((row) => row.userId).sort()).toEqual([...PAID].sort())
    expect(rows[0]?.href).toMatch(/billing$/)
    const marked = await db.select().from(subscriptions)
    expect(
      marked.filter((row) => row.expiringNotifiedAt).map((row) => row.userId)
    ).not.toContain(DEMO_IDS.mechanic)
  })

  test("says nothing earlier than three days before the end, or after it", async () => {
    daysBeforeEnd(5)
    expect(await notifyExpiring()).toBe(0)
    daysBeforeEnd(-1)
    expect(await notifyExpiring()).toBe(0)
    expect(await notices()).toHaveLength(0)
  })

  test("running it twice tells each owner once", async () => {
    daysBeforeEnd(2)
    await notifyExpiring()
    daysBeforeEnd(1)
    expect(await notifyExpiring()).toBe(0)
    expect(await notices()).toHaveLength(3)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    daysBeforeEnd(2)
    const crash = failOnCall(queries, "lockExpiringUnnotified", 2)

    await expect(notifyExpiring(2)).rejects.toThrow("crashed")
    expect(await notices()).toHaveLength(2)

    crash.mockRestore()
    expect(await notifyExpiring(2)).toBe(1)
    const rows = await notices()
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((row) => row.userId)).size).toBe(3)
  })
})
