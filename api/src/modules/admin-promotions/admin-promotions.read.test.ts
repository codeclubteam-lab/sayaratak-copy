import { beforeEach, describe, expect, test } from "bun:test"
import { promotionPriceSchema } from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { myPromotionSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { promotions } from "~/modules/promotions/promotions.tables"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()

// Seed: 54 promotions. promo-1 to promo-47 run (promo-1 is the dealer's 3-day Featured with an
// approved receipt), promo-48 to promo-52 ended, promo-53 (a bump) and promo-54 (7-day Featured)
// wait for payment.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const table = async (query = "") => {
  const res = await call("GET", `/admin/promotions${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(myPromotionSchema))
}
const idsOf = async (query: string) =>
  (await table(query)).items.map((item) => item.id).sort()

describe("admin promotion routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/promotion-prices"],
      ["PATCH", "/admin/promotion-prices/bump"],
      ["GET", "/admin/promotions"],
      ["POST", "/admin/promotions/grant"],
      ["POST", "/admin/promotions/promo-1/end"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/promotion-prices", () => {
  test("is Featured by length, then the bump", async () => {
    const res = await call("GET", "/admin/promotion-prices")
    expect(res.status).toBe(200)
    const rows = await expectSchema(res, z.array(promotionPriceSchema))
    expect(rows.map((row) => row.id)).toEqual([
      "featured-3",
      "featured-7",
      "featured-14",
      "bump",
    ])
  })
})

describe("GET /admin/promotions", () => {
  test("lists the waiting ones first, then the newest start", async () => {
    const page = await table("?pageSize=60")
    expect(page.total).toBe(seeded.promotions.length)
    expect(page.items.slice(0, 2).map((i) => i.id)).toEqual([
      "promo-53",
      "promo-54",
    ])
    const starts = page.items.slice(2).map((item) => item.startsAt ?? "")
    expect(starts).toEqual([...starts].sort().reverse())
  })

  test("shows the listing, the price and the receipt state", async () => {
    const [paid] = (await table("?pageSize=60")).items.filter(
      (item) => item.id === "promo-1"
    )
    expect(paid).toMatchObject({
      type: "featured",
      status: "active",
      source: "paid",
      price: 20000,
      paymentStatus: "approved",
      listing: { id: "l0000e", slug: expect.any(String) },
    })
    const waiting = (await table("?status=pending_payment")).items
    expect(waiting.map((item) => item.paymentStatus).sort()).toEqual([
      "pending_review",
      "pending_review",
    ])
  })

  test("filters by status and listing title", async () => {
    expect((await idsOf("?status=ended&pageSize=60")).length).toBe(5)
    expect((await idsOf("?status=active&pageSize=60")).length).toBe(47)
    expect(await idsOf("?status=nope")).toEqual([])
    const title = (await table("?pageSize=60")).items.find(
      (item) => item.id === "promo-48"
    )?.listing.title
    expect(
      await idsOf(
        `?q=${encodeURIComponent((title ?? "").toUpperCase())}&pageSize=60`
      )
    ).toContain("promo-48")
    expect(await idsOf("?q=zzzz")).toEqual([])
  })

  test("a running promotion past its end reads as ended", async () => {
    // The job has not marked it yet: the end is in the past.
    await db
      .update(promotions)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(promotions.id, "promo-1"))
    expect(await idsOf("?status=ended&pageSize=60")).toContain("promo-1")
    expect(await idsOf("?status=active&pageSize=60")).not.toContain("promo-1")
  })
})
