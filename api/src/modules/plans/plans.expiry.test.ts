import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { and, asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./plans.expiry.queries"
import { endExpired } from "./plans.expiry.service"
import { subscriptions } from "./plans.tables"

// Seed: four active subscriptions that all end together: the dealership on Growth (paid), the
// workshop on Plus (paid), a person on Plus (paid) and the mechanic on Basic (free).
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

let endsAt = new Date()

beforeEach(async () => {
  await resetDb()
  const [first] = await db.select().from(subscriptions)
  if (!first) throw new Error("the seed has subscriptions")
  endsAt = first.endsAt
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

const after = (ms: number) =>
  spyOn(clock, "now").mockReturnValue(new Date(endsAt.getTime() + ms))
const active = (userId: string) =>
  db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .then(([row]) => row)
const all = () => db.select().from(subscriptions).orderBy(asc(subscriptions.id))

describe("endExpired (subscription-end job)", () => {
  test("does nothing before a subscription ends", async () => {
    after(-HOUR_MS)
    const before = await all()
    expect(await endExpired()).toBe(0)
    expect(await all()).toEqual(before)
  })

  test("a paid plan drops to the audience's free plan", async () => {
    after(HOUR_MS)
    const now = new Date(endsAt.getTime() + HOUR_MS)
    expect(await endExpired()).toBe(4)

    const dealer = await active(DEMO_IDS.dealership)
    expect(dealer).toMatchObject({
      planId: "plan-dealer-starter",
      price: 0,
      listingLimit: 10,
    })
    expect(dealer?.startsAt).toEqual(now)
    expect(dealer?.endsAt).toEqual(new Date(now.getTime() + 30 * DAY_MS))
    expect((await active(DEMO_IDS.workshop))?.planId).toBe(
      "plan-workshop-basic"
    )
    const old = (await all()).filter((row) => row.id === "sub-2")
    expect(old[0]?.status).toBe("expired")
  })

  test("a free plan renews itself", async () => {
    after(HOUR_MS)
    await endExpired()
    const renewed = await active(DEMO_IDS.mechanic)
    expect(renewed).toMatchObject({ planId: "plan-mechanic-basic", price: 0 })
    expect(renewed?.id).not.toBe("sub-4")
  })

  test("a person's paid plan just ends: individuals have no free subscription", async () => {
    after(HOUR_MS)
    await endExpired()
    expect(await active(DEMO_IDS.user)).toBeUndefined()
    const mine = (await all()).filter((row) => row.userId === DEMO_IDS.user)
    expect(mine.map((row) => row.status)).toEqual(["expired"])
  })

  test("running it twice gives the same result", async () => {
    after(HOUR_MS)
    expect(await endExpired()).toBe(4)
    const snapshot = await all()
    expect(await endExpired()).toBe(0)
    expect(await all()).toEqual(snapshot)
  })

  test("leaves an account alone when its subscription changed since the list was read", async () => {
    after(-HOUR_MS)
    const [dealer] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, "sub-2"))
    const stale = spyOn(queries, "listEnded").mockResolvedValueOnce([
      {
        id: "sub-2",
        userId: DEMO_IDS.dealership,
        audience: "dealership",
        planPrice: 350_000,
      },
    ])
    try {
      await endExpired()
    } finally {
      stale.mockRestore()
    }
    expect((await active(DEMO_IDS.dealership))?.id).toBe(dealer?.id)
    expect(
      (await all()).filter((row) => row.userId === DEMO_IDS.dealership)
    ).toHaveLength(1)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    after(HOUR_MS)
    const crash = failOnCall(queries, "listEnded", 2)

    await expect(endExpired(2)).rejects.toThrow("crashed")
    // The first two accounts (sub-1, sub-2 by end then id) were ended and got their plan.
    expect(
      (await all()).filter((row) => row.status === "expired")
    ).toHaveLength(2)

    crash.mockRestore()
    expect(await endExpired(2)).toBe(2)
    expect(
      (await all()).filter((row) => row.status === "expired")
    ).toHaveLength(4)
    expect((await all()).filter((row) => row.status === "active")).toHaveLength(
      3
    )
  })
})
