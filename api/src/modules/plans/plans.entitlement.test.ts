import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { meSubscriptionSchema } from "@sayaratak/shared/schemas/responses"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { endExpired } from "./plans.expiry.service"
import {
  getActivePlan,
  getActiveSubscription,
  getCreditsOf,
  listPaidOwnerIds,
} from "./plans.service"
import { subscriptions } from "./plans.tables"

// Seed: the dealership on Growth (80 listings, 3 Featured credits), the workshop on Plus (no caps),
// a person on Plus (15 listings) and the mechanic on the free Basic. All end together.
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

const at = (ms: number) =>
  spyOn(clock, "now").mockReturnValue(new Date(endsAt.getTime() + ms))
const mine = async (as: "dealership" | "workshop" | "user" | "mechanic") => {
  const { cookie } = await signIn(as)
  return expectSchema(
    await req("/me/subscription", { headers: { cookie } }),
    meSubscriptionSchema
  )
}

describe("access follows the end date, without waiting for the job", () => {
  test("a paid plan is in force until its end", async () => {
    at(-HOUR_MS)
    expect(await getActiveSubscription(db, DEMO_IDS.dealership)).toMatchObject({
      planId: "plan-dealer-growth",
      listingLimit: 80,
    })
    expect(await getCreditsOf(db, DEMO_IDS.dealership)).toEqual({
      total: 3,
      left: 3,
    })
  })

  test("once it has ended a paid business plan counts as the audience's free plan", async () => {
    at(HOUR_MS)
    const dealer = await getActiveSubscription(db, DEMO_IDS.dealership)
    expect(dealer).toMatchObject({
      planId: "plan-dealer-starter",
      price: 0,
      listingLimit: 10,
      status: "active",
    })
    expect(dealer?.startsAt).toEqual(endsAt)
    expect((await getActivePlan(db, DEMO_IDS.workshop))?.id).toBe(
      "plan-workshop-basic"
    )
    expect((await getActivePlan(db, DEMO_IDS.workshop))?.serviceLimit).toBe(10)
    expect(await getCreditsOf(db, DEMO_IDS.dealership)).toEqual({
      total: 0,
      left: 0,
    })
  })

  test("the billing page shows the free plan and its limit", async () => {
    at(HOUR_MS)
    const page = await mine("dealership")
    expect(page.plan?.id).toBe("plan-dealer-starter")
    expect(page.subscription).toMatchObject({
      planId: "plan-dealer-starter",
      price: 0,
      usage: { limit: 10 },
    })
    expect(page.credits).toEqual({ total: 0, left: 0 })
  })

  test("a free plan never lapses: it stays until the job renews it", async () => {
    at(HOUR_MS)
    const mechanic = await getActiveSubscription(db, DEMO_IDS.mechanic)
    expect(mechanic).toMatchObject({
      id: "sub-4",
      planId: "plan-mechanic-basic",
    })
    expect(mechanic?.endsAt).toEqual(endsAt)
  })

  test("a person's paid plan just ends: they fall back to the free listing limit", async () => {
    at(HOUR_MS)
    expect(await getActiveSubscription(db, DEMO_IDS.user)).toBeUndefined()
    const page = await mine("user")
    expect(page.subscription).toBeNull()
    expect(page.plan).toBeNull()
  })

  test("the paid boost stops at the end date", async () => {
    at(-HOUR_MS)
    const before = await listPaidOwnerIds(db)
    expect([...before].sort()).toEqual(
      [DEMO_IDS.dealership, DEMO_IDS.user, DEMO_IDS.workshop].sort()
    )
    at(HOUR_MS)
    expect((await listPaidOwnerIds(db)).size).toBe(0)
  })

  test("the job then stores what the reads already showed", async () => {
    at(HOUR_MS)
    const shown = await getActiveSubscription(db, DEMO_IDS.dealership)
    await endExpired()
    const stored = await getActiveSubscription(db, DEMO_IDS.dealership)
    expect(stored).toMatchObject({
      planId: shown?.planId,
      price: shown?.price,
      listingLimit: shown?.listingLimit,
    })
    expect(stored?.id).not.toBe(shown?.id)
    // The new period runs from the moment the job made it.
    expect(stored?.endsAt.getTime()).toBe(
      endsAt.getTime() + HOUR_MS + 30 * DAY_MS
    )
  })
})
