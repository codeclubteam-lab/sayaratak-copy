import { beforeEach, describe, expect, test } from "bun:test"
import { promotionSchema } from "@sayaratak/shared/schemas/billing"
import { meSubscriptionSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import {
  buildSeed,
  call,
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { promotions } from "./promotions.tables"

// Seed: u-omar is on plan-user-plus (1 Featured credit), u-dealer on plan-dealer-growth (3), the
// workshop on plan-workshop-plus (none). Credits spent so far: none.
const seeded = buildSeed()
const own = (id: string) => seeded.listings.filter((l) => l.ownerUserId === id)
const omars = own(DEMO_IDS.user)[0]
const dealers = own(DEMO_IDS.dealership)
if (!omars || dealers.length < 4) throw new Error("the mock seeds listings")

const order = (who: Awaited<ReturnType<typeof signIn>>, body: object) =>
  call(who, "/promotions", { method: "POST", body })
const creditsLeft = async (who: Awaited<ReturnType<typeof signIn>>) =>
  (
    await expectSchema(
      await req("/me/subscription", { headers: { cookie: who.cookie } }),
      meSubscriptionSchema
    )
  ).credits

beforeEach(resetDb)

describe("POST /promotions with a credit", () => {
  test("starts a 7-day Featured at once, free, and spends one credit", async () => {
    const seller = await signIn("dealership")
    expect(await creditsLeft(seller)).toEqual({ total: 3, left: 3 })
    const promo = await expectSchema(
      await order(seller, { listingId: dealers[0]?.id, useCredit: true }),
      promotionSchema
    )
    expect(promo).toMatchObject({
      type: "featured",
      status: "active",
      durationDays: 7,
      source: "credit",
    })
    const span =
      Date.parse(promo.endsAt ?? "") - Date.parse(promo.startsAt ?? "")
    expect(span).toBe(7 * 86_400_000)
    expect(await creditsLeft(seller)).toEqual({ total: 3, left: 2 })
  })

  test("is 409 no_credits once they are spent, and for a plan with none", async () => {
    const seller = await signIn("dealership")
    for (const listing of dealers.slice(0, 3))
      expect(
        (await order(seller, { listingId: listing.id, useCredit: true })).status
      ).toBe(200)
    const spent = await order(seller, {
      listingId: dealers[3]?.id,
      useCredit: true,
    })
    expect(spent.status).toBe(409)
    expect(await spent.json()).toMatchObject({ code: "no_credits" })
    expect(await creditsLeft(seller)).toEqual({ total: 3, left: 0 })
  })

  test("lets one of two orders made together take the last credit", async () => {
    const buyer = await signIn("user")
    const before = await db.$count(promotions)
    const statuses = (
      await Promise.all(
        own(DEMO_IDS.user)
          .slice(0, 2)
          .map((l) => order(buyer, { listingId: l.id, useCredit: true }))
      )
    )
      .map((res) => res.status)
      .sort()
    expect(statuses).toEqual([200, 409])
    expect(await db.$count(promotions)).toBe(before + 1)
  })

  test("wins over a price sent with it, and runs the listing's Featured", async () => {
    const buyer = await signIn("user")
    const promo = await expectSchema(
      await order(buyer, {
        listingId: omars.id,
        priceId: "bump",
        useCredit: true,
      }),
      promotionSchema
    )
    expect(promo.source).toBe("credit")
    const [row] = await db
      .select({ status: promotions.status })
      .from(promotions)
      .where(eq(promotions.id, promo.id))
    expect(row?.status).toBe("active")
  })
})
