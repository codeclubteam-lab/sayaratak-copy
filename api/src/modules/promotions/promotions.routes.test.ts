import { beforeEach, describe, expect, test } from "bun:test"
import {
  promotionPriceSchema,
  promotionSchema,
} from "@sayaratak/shared/schemas/billing"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { user } from "~/modules/auth/auth.tables"
import { listings } from "~/modules/listings/listings.tables"
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

// Seed: u-omar has promo-53 (a bump waiting for payment) and 43 listings; u-dealer has promo-54
// (Featured, 7 days, waiting). Neither owns a listing the other can order for.
const seeded = buildSeed()
const withPromotion = new Set(seeded.promotions.map((p) => p.listingId))
const waiting = seeded.promotions.find((p) => p.id === "promo-53")
const mine = seeded.listings.find(
  (l) => l.ownerUserId === DEMO_IDS.user && !withPromotion.has(l.id)
)
const dealers = seeded.listings.find(
  (l) => l.ownerUserId === DEMO_IDS.dealership
)
if (!waiting || !mine || !dealers) throw new Error("the mock seeds these")

const order = (who: Awaited<ReturnType<typeof signIn>>, body: object) =>
  call(who, "/promotions", { method: "POST", body })

beforeEach(resetDb)

describe("GET /promotion-prices", () => {
  test("lists Featured by length, then the bump, to anyone", async () => {
    const prices = await expectSchema(
      await req("/promotion-prices"),
      z.array(promotionPriceSchema)
    )
    expect(prices.map((p) => p.id)).toEqual([
      "featured-3",
      "featured-7",
      "featured-14",
      "bump",
    ])
  })
})

describe("POST /promotions with a price", () => {
  test("makes an unpaid order and returns the same one when asked again", async () => {
    const buyer = await signIn("user")
    const body = { listingId: mine.id, priceId: "featured-7" }
    const first = await expectSchema(await order(buyer, body), promotionSchema)
    expect(first).toMatchObject({
      listingId: mine.id,
      type: "featured",
      status: "pending_payment",
      durationDays: 7,
      source: "paid",
    })
    expect(first.startsAt).toBeUndefined()
    const again = await expectSchema(await order(buyer, body), promotionSchema)
    expect(again.id).toBe(first.id)
    const other = await expectSchema(
      await order(buyer, { ...body, priceId: "featured-3" }),
      promotionSchema
    )
    expect(other.id).not.toBe(first.id)
  })

  test("lets two orders made together make one", async () => {
    const buyer = await signIn("user")
    const body = { listingId: mine.id, priceId: "bump" }
    const results = await Promise.all([order(buyer, body), order(buyer, body)])
    const [a, b] = await Promise.all(
      results.map((res) => expectSchema(res, promotionSchema))
    )
    expect(a?.id).toBe(b?.id)
    expect(await db.$count(promotions, eq(promotions.listingId, mine.id))).toBe(
      1
    )
  })

  test("is 409 bump_wait for a day after a bump, and Featured is still open", async () => {
    const buyer = await signIn("user")
    const bump = { listingId: mine.id, priceId: "bump" }
    const bumpedAt = (hoursAgo: number) =>
      db
        .update(listings)
        .set({ bumpedAt: new Date(Date.now() - hoursAgo * 3_600_000) })
        .where(eq(listings.id, mine.id))
    await bumpedAt(23)
    const early = await order(buyer, bump)
    expect(early.status).toBe(409)
    expect(await early.json()).toMatchObject({ code: "bump_wait" })
    expect(
      (await order(buyer, { ...bump, priceId: "featured-3" })).status
    ).toBe(200)
    await bumpedAt(25)
    expect((await order(buyer, bump)).status).toBe(200)
  })
})

describe("POST /promotions refuses", () => {
  test("a signed-out or banned caller", async () => {
    const body = { listingId: mine.id, priceId: "bump" }
    expect(
      (await req("/promotions", { method: "POST", body: JSON.stringify(body) }))
        .status
    ).toBe(401)
    const buyer = await signIn("user")
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, DEMO_IDS.user))
    expect(await (await order(buyer, body)).json()).toMatchObject({
      code: "banned",
    })
  })

  test("an unknown listing or price, and someone else's listing", async () => {
    const buyer = await signIn("user")
    const status = async (body: object) => (await order(buyer, body)).status
    expect(await status({ listingId: "nope", priceId: "bump" })).toBe(404)
    expect(await status({ listingId: mine.id, priceId: "nope" })).toBe(404)
    expect(await status({ listingId: dealers.id, priceId: "bump" })).toBe(403)
    expect(await status({ listingId: dealers.id, useCredit: true })).toBe(403)
    expect(await db.$count(promotions)).toBe(seeded.promotions.length)
  })

  test("a body with neither a price nor a credit", async () => {
    const buyer = await signIn("user")
    const res = await order(buyer, { listingId: mine.id })
    expect(res.status).toBe(422)
    expect(await order(buyer, { priceId: "bump" })).toHaveProperty(
      "status",
      422
    )
  })
})
