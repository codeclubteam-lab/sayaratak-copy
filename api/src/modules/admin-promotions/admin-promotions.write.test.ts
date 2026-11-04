import { beforeEach, describe, expect, test } from "bun:test"
import { promotionPriceSchema } from "@sayaratak/shared/schemas/billing"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { myPromotionSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { listings } from "~/modules/listings/listings.tables"
import {
  promotionPrices,
  promotions,
} from "~/modules/promotions/promotions.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, req, resetDb } from "../../../tests/helpers"

// Seed: l00006 has no promotion; promo-1 runs on l0000e; promo-53 and promo-54 wait for payment.
const DAY_MS = 86_400_000

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const patchPrice = (id: string, body: unknown) =>
  call("PATCH", `/admin/promotion-prices/${id}`, body)
const grant = (body: unknown) => call("POST", "/admin/promotions/grant", body)
const end = (id: string) => call("POST", `/admin/promotions/${id}/end`)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
const promotionOf = (id: string) =>
  db
    .select()
    .from(promotions)
    .where(eq(promotions.id, id))
    .then(([row]) => row)
const shownOn = async (id: string) =>
  (await expectSchema(await req(`/listings/${id}`), listingSchema)).promotions

describe("PATCH /admin/promotion-prices/:id", () => {
  test("changes the price and the length of a Featured and writes the audit row", async () => {
    const res = await patchPrice("featured-7", {
      price: 45000,
      durationDays: 10,
    })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, promotionPriceSchema)).toEqual({
      id: "featured-7",
      type: "featured",
      durationDays: 10,
      price: 45000,
    })
    expect(await auditOf("featured-7")).toMatchObject([
      {
        action: "promotion_price.update",
        before: { price: 40000, durationDays: 7 },
        after: { price: 45000, durationDays: 10 },
      },
    ])
  })

  test("a bump has no length; an empty edit changes nothing", async () => {
    const bump = await expectSchema(
      await patchPrice("bump", { price: 0, durationDays: 5 }),
      promotionPriceSchema
    )
    expect(bump).toMatchObject({ price: 0, durationDays: 0 })
    expect((await patchPrice("featured-3", {})).status).toBe(200)
  })

  test("refuses a length another row has (409), a bad value (422) and an unknown row (404)", async () => {
    const taken = await patchPrice("featured-3", { durationDays: 7 })
    expect(taken.status).toBe(409)
    expect((await errorOf(taken)).code).toBe("conflict")
    for (const body of [
      { price: -1 },
      { durationDays: 0 },
      { durationDays: 91 },
    ])
      expect((await patchPrice("featured-3", body)).status).toBe(422)
    expect((await patchPrice("nope", { price: 1 })).status).toBe(404)
    const [row] = await db
      .select()
      .from(promotionPrices)
      .where(eq(promotionPrices.id, "featured-3"))
    expect(row).toMatchObject({ price: 20000, durationDays: 3 })
  })
})

describe("POST /admin/promotions/grant", () => {
  test("starts a free Featured now, shows it on the listing and writes the audit row", async () => {
    const res = await grant({ listingId: "l00006", type: "featured", days: 5 })
    expect(res.status).toBe(200)
    const made = await expectSchema(res, myPromotionSchema)
    expect(made).toMatchObject({
      type: "featured",
      status: "active",
      source: "admin_grant",
      durationDays: 5,
      price: 0,
      paymentStatus: "none",
      listing: { id: "l00006" },
    })
    const days =
      (Date.parse(made.endsAt ?? "") - Date.parse(made.startsAt ?? "")) / DAY_MS
    expect(days).toBe(5)
    expect(await shownOn("l00006")).toHaveLength(1)
    expect(await auditOf(made.id)).toMatchObject([
      {
        action: "promotion.grant",
        targetType: "promotion",
        adminId: "u-admin",
        after: { listingId: "l00006", type: "featured", days: 5 },
      },
    ])
  })

  test("days default to 7", async () => {
    const made = await expectSchema(
      await grant({ listingId: "l00006", type: "featured" }),
      myPromotionSchema
    )
    expect(made.durationDays).toBe(7)
  })

  test("a bump ends at once and moves the listing to the top", async () => {
    const made = await expectSchema(
      await grant({ listingId: "l00006", type: "bump", days: 9 }),
      myPromotionSchema
    )
    expect(made).toMatchObject({ status: "ended", durationDays: 0 })
    expect(made.endsAt).toBe(made.startsAt)
    const [row] = await db
      .select({ bumpedAt: listings.bumpedAt })
      .from(listings)
      .where(eq(listings.id, "l00006"))
    expect(row?.bumpedAt?.toISOString()).toBe(made.startsAt)
  })

  test("answers 404 for an unknown listing and 422 for a bad grant", async () => {
    expect((await grant({ listingId: "nope", type: "featured" })).status).toBe(
      404
    )
    for (const body of [
      {},
      { listingId: "l00006", type: "gold" },
      { listingId: "l00006", type: "featured", days: 0 },
    ])
      expect((await grant(body)).status).toBe(422)
  })
})

describe("POST /admin/promotions/:id/end", () => {
  test("ends a running promotion now; the listing loses it at once", async () => {
    expect(await shownOn("l0000e")).toHaveLength(1)
    const res = await end("promo-1")
    expect(res.status).toBe(200)
    const ended = await expectSchema(res, myPromotionSchema)
    expect(ended.status).toBe("ended")
    expect(Date.parse(ended.endsAt ?? "")).toBeLessThanOrEqual(Date.now())
    expect(await shownOn("l0000e")).toHaveLength(0)
    expect(await auditOf("promo-1")).toMatchObject([
      {
        action: "promotion.end",
        before: { status: "active" },
        after: { status: "ended" },
      },
    ])
  })

  test("only a running promotion: 409 `conflict`; 404 for an unknown one", async () => {
    for (const id of ["promo-48", "promo-54"]) {
      const res = await end(id)
      expect(res.status).toBe(409)
      expect((await errorOf(res)).code).toBe("conflict")
    }
    expect((await promotionOf("promo-54"))?.status).toBe("pending_payment")
    expect((await end("nope")).status).toBe(404)
    expect((await end("promo-1")).status).toBe(200)
    expect((await end("promo-1")).status).toBe(409)
  })
})
