import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { plans, subscriptions } from "./plans.tables"

const seeded = buildSeed()
const omar = seeded.subscriptions.find((s) => s.userId === "u-omar")
if (!omar) throw new Error("the mock seeds the demo seller's plan")

beforeEach(resetDb)

describe("plan tables", () => {
  test("hold every mock plan and subscription, with the custom limit", async () => {
    expect(await db.$count(plans)).toBe(seeded.plans.length)
    const [row] = await db
      .select({ limit: subscriptions.listingLimit })
      .from(subscriptions)
      .where(eq(subscriptions.id, omar.id))
    expect(row?.limit).toBe(omar.usage.limit)
  })

  test("allow one active subscription per user", async () => {
    const again = {
      ...omar,
      id: "sub-x",
      startsAt: new Date(omar.startsAt),
      endsAt: new Date(omar.endsAt),
    }
    const error = await db
      .insert(subscriptions)
      .values(again)
      .catch((error) => error)
    expect(error.cause.constraint).toBe("subscriptions_one_active")
    await db.insert(subscriptions).values({ ...again, status: "expired" })
  })

  test("refuse to delete a plan in use, and forget a deleted plan picked in onboarding", async () => {
    const used = await db
      .delete(plans)
      .where(eq(plans.id, omar.planId))
      .catch((error) => error)
    expect(used.cause.errno).toBe("23503")
    const free = seeded.plans.find(
      (p) => !seeded.subscriptions.some((s) => s.planId === p.id)
    )
    await db
      .update(user)
      .set({ chosenPlanId: free?.id })
      .where(eq(user.id, "u-omar"))
    await db.delete(plans).where(eq(plans.id, free?.id ?? ""))
    const [row] = await db
      .select({ plan: user.chosenPlanId })
      .from(user)
      .where(eq(user.id, "u-omar"))
    expect(row).toEqual({ plan: null })
  })
})
