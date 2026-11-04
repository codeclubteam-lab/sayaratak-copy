import { beforeEach, describe, expect, test } from "bun:test"
import { myPromotionsSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import {
  buildSeed,
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { promotions } from "./promotions.tables"

// Seed: u-omar's promo-53 is a bump waiting for payment (pay-3 is under review); he owns 43 listings.
const seeded = buildSeed()
const waiting = seeded.promotions.find((p) => p.id === "promo-53")
if (!waiting) throw new Error("the mock seeds promo-53")

beforeEach(resetDb)

describe("GET /me/promotions", () => {
  test("lists the caller's promotions, the waiting one first, with listing and price", async () => {
    const buyer = await signIn("user")
    const { items } = await expectSchema(
      await req("/me/promotions", { headers: { cookie: buyer.cookie } }),
      myPromotionsSchema
    )
    expect(items).toHaveLength(
      seeded.promotions.filter(
        (p) =>
          seeded.listings.find((l) => l.id === p.listingId)?.ownerUserId ===
          DEMO_IDS.user
      ).length
    )
    expect(items[0]).toMatchObject({
      id: waiting.id,
      status: "pending_payment",
      price: 5000,
      paymentStatus: "pending_review",
    })
    expect(items[0]?.listing.id).toBe(waiting.listingId)
  })

  test("reads a running promotion past its end as ended, and shows a new order", async () => {
    const buyer = await signIn("user")
    await db
      .update(promotions)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(promotions.status, "active"))
    const { items } = await expectSchema(
      await req("/me/promotions", { headers: { cookie: buyer.cookie } }),
      myPromotionsSchema
    )
    const own = items.filter((p) => p.source === "paid" && p.startsAt)
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((p) => p.status === "ended")).toBe(true)
  })

  test("is 401 signed out and empty for an account with no listing", async () => {
    expect((await req("/me/promotions")).status).toBe(401)
    const shop = await signIn("workshop")
    const { items } = await expectSchema(
      await req("/me/promotions", { headers: { cookie: shop.cookie } }),
      myPromotionsSchema
    )
    expect(items).toEqual([])
  })
})
