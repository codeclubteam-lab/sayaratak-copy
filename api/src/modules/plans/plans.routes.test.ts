import { beforeEach, describe, expect, test } from "bun:test"
import { planSchema } from "@sayaratak/shared/schemas/billing"
import { meSubscriptionSchema } from "@sayaratak/shared/schemas/responses"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { user } from "~/modules/auth/auth.tables"
import { listings } from "~/modules/listings/listings.tables"
import { promotions } from "~/modules/promotions/promotions.tables"
import { settings } from "~/modules/content/content.tables"
import { db } from "~/shared/db/client"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { subscriptions } from "./plans.tables"

// Seed: u-dealer has sub-2 (plan-dealer-growth, 3 Featured credits) and pay-2 for it under review;
// u-workshop has sub-3 (plan-workshop-plus); plan-user-free is the individuals' free plan.
beforeEach(resetDb)

const mine = async (cookie: string) =>
  expectSchema(
    await req("/me/subscription", { headers: { cookie } }),
    meSubscriptionSchema
  )

describe("GET /plans", () => {
  test("answers the enabled plans of an audience in list order, cached for a minute", async () => {
    const res = await req("/plans?audience=dealership")
    expect(res.headers.get("cache-control")).toBe("public, max-age=60")
    const plans = await expectSchema(res, z.array(planSchema))
    expect(plans.map((p) => p.id)).toEqual([
      "plan-dealer-starter",
      "plan-dealer-growth",
      "plan-dealer-pro",
    ])
  })

  test("has no individual plans while individual subscriptions are off", async () => {
    await db.update(settings).set({ individualSubscriptionsEnabled: false })
    const all = await expectSchema(await req("/plans"), z.array(planSchema))
    expect(all.some((p) => p.audience === "user")).toBe(false)
    const users = await expectSchema(
      await req("/plans?audience=user"),
      z.array(planSchema)
    )
    expect(users).toEqual([])
  })
})

describe("GET /me/subscription", () => {
  test("shows the plan, usage, credits and the plan under review", async () => {
    const dealer = await signIn("dealership")
    const me = await mine(dealer.cookie)
    expect(me.subscription).toMatchObject({
      id: "sub-2",
      planId: "plan-dealer-growth",
      status: "active",
    })
    expect(me.plan?.id).toBe("plan-dealer-growth")
    expect(me.credits).toEqual({ total: 3, left: 3 })
    expect(me.reviewPlan?.id).toBe("plan-dealer-growth")
    expect(me.usage.limit).toBe(me.subscription?.usage.limit ?? null)
  })

  test("counts a credit promotion started this period, not an older one", async () => {
    const dealer = await signIn("dealership")
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.ownerUserId, "u-dealer"))
    if (!listing) throw new Error("the seed gives the dealer listings")
    const [sub] = await db
      .select({ startsAt: subscriptions.startsAt })
      .from(subscriptions)
      .where(eq(subscriptions.id, "sub-2"))
    const day = 86_400_000
    const credit = {
      listingId: listing.id,
      type: "featured",
      status: "ended",
      durationDays: 7,
      source: "credit",
      endsAt: new Date(),
    } as const
    await db.insert(promotions).values([
      {
        ...credit,
        id: "pr-in",
        startsAt: new Date((sub?.startsAt.getTime() ?? 0) + day),
      },
      {
        ...credit,
        id: "pr-old",
        startsAt: new Date((sub?.startsAt.getTime() ?? 0) - day),
      },
    ])
    expect((await mine(dealer.cookie)).credits).toEqual({ total: 3, left: 2 })
  })

  test("answers a pending subscription with no credits", async () => {
    const shop = await signIn("workshop")
    await db
      .update(subscriptions)
      .set({ status: "pending" })
      .where(eq(subscriptions.id, "sub-3"))
    const me = await mine(shop.cookie)
    expect(me.subscription?.status).toBe("pending")
    expect(me.credits).toEqual({ total: 0, left: 0 })
  })

  test("is 401 signed out", async () => {
    expect((await req("/me/subscription")).status).toBe(401)
  })
})

describe("DELETE /me/chosen-plan", () => {
  test("forgets the pick and answers the account", async () => {
    const shop = await signIn("workshop")
    await db
      .update(user)
      .set({ chosenPlanId: "plan-workshop-plus" })
      .where(eq(user.id, "u-workshop"))
    const me = await expectSchema(
      await req("/me/chosen-plan", {
        method: "DELETE",
        headers: { cookie: shop.cookie, origin: shop.origin },
      }),
      userSchema
    )
    expect(me.chosenPlanId).toBeUndefined()
    const [row] = await db
      .select({ chosen: user.chosenPlanId })
      .from(user)
      .where(eq(user.id, "u-workshop"))
    expect(row?.chosen).toBeNull()
  })
})
