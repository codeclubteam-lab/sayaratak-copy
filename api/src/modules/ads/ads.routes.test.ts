import { beforeEach, describe, expect, test } from "bun:test"
import {
  adPageSchema,
  adTargetSchema,
  campaignSchema,
} from "@sayaratak/shared/schemas/ads"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { listings } from "~/modules/listings/listings.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { fileOf, postUpload } from "../../../tests/files"
import {
  buildSeed,
  call,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { adPages, campaigns } from "./ads.tables"

// Seed: camp-1 is u-dealer's, approved, on search_car, search_truck and home_middle from 3 days ago
// for 2 weeks; camp-2 is u-workshop's, under review, on listing_detail and directory_workshops from
// tomorrow for 1 week. Every page has 3 slots; home_top costs 300000 a week, search_car 120000.
const seeded = buildSeed()
const dealerSlug =
  seeded.dealerships.find((d) => d.ownerId === "u-dealer")?.slug ?? ""
const today = new Date().toISOString().slice(0, 10)
const copy = {
  ar: { heading: "عنوان", body: "نص", cta: "زر" },
  en: { heading: "Heading", body: "Text", cta: "Go" },
}

beforeEach(resetDb)

/** Uploads a picture as `who` and answers the address the web sends back as the banner image. */
async function uploadBanner(who: SignedIn) {
  const media = await expectSchema(
    await postUpload(who, { file: fileOf("jpeg") }),
    mediaSchema
  )
  return media.url
}
const book = async (who: SignedIn, over: object = {}) =>
  call(who, "/campaigns", {
    method: "POST",
    body: {
      creative: { imageUrl: await uploadBanner(who), copy },
      href: `/dealerships/${dealerSlug}`,
      pages: ["home_top", "search_car"],
      startDate: today,
      weeks: 2,
      ...over,
    },
  })

describe("GET /ad-pages", () => {
  test("is 401 signed out, and counts held slots for the dates asked", async () => {
    expect((await req("/ad-pages")).status).toBe(401)
    const dealer = await signIn("dealership")
    const ask = async (query: string) =>
      expectSchema(
        await req(`/ad-pages${query}`, { headers: { cookie: dealer.cookie } }),
        z.array(adPageSchema)
      )
    const all = await ask("")
    expect(all.every((page) => page.free === page.slots)).toBe(true)
    const busy = await ask(`?startDate=${today}&weeks=2`)
    const free = Object.fromEntries(busy.map((page) => [page.id, page.free]))
    expect(free).toMatchObject({
      home_top: 3,
      search_car: 2,
      home_middle: 2,
      listing_detail: 2,
    })
  })
})

describe("GET /me/ad-targets", () => {
  test("lists the profile first, then public listings only; other roles are 403", async () => {
    const dealer = await signIn("dealership")
    const read = async () =>
      expectSchema(
        await req("/me/ad-targets", { headers: { cookie: dealer.cookie } }),
        z.array(adTargetSchema)
      )
    const before = await read()
    expect(before[0]?.href).toBe(`/dealerships/${dealerSlug}`)
    expect(before.slice(1).every((t) => t.href.startsWith("/listing/"))).toBe(
      true
    )
    expect(before.length).toBe(51)
    const hidden = before[1]?.href.replace("/listing/", "") ?? ""
    await db
      .update(listings)
      .set({ moderation: "pending" })
      .where(eq(listings.slug, hidden))
    expect((await read()).some((t) => t.href.endsWith(hidden))).toBe(false)
    const buyer = await signIn("user")
    expect(
      (await req("/me/ad-targets", { headers: { cookie: buyer.cookie } }))
        .status
    ).toBe(403)
  })
})

describe("POST /campaigns", () => {
  test("books an unpaid campaign at the pages' weekly prices times the weeks", async () => {
    const dealer = await signIn("dealership")
    const campaign = await expectSchema(await book(dealer), campaignSchema)
    expect(campaign).toMatchObject({
      status: "pending_payment",
      amount: (300_000 + 120_000) * 2,
      weeks: 2,
      pages: ["home_top", "search_car"],
      ownerId: "u-dealer",
    })
    const mine = await expectSchema(
      await req("/me/campaigns", { headers: { cookie: dealer.cookie } }),
      z.array(campaignSchema)
    )
    expect(mine.map((c) => c.id)).toEqual([campaign.id, "camp-1"])
    const [row] = await db
      .select({ at: uploads.attachedAt })
      .from(campaigns)
      .innerJoin(uploads, eq(uploads.id, campaigns.imageUploadId))
      .where(eq(campaigns.id, campaign.id))
    expect(row?.at).not.toBeNull()
  })

  test("is 422 for a picture that is not the advertiser's own, or one already used", async () => {
    const dealer = await signIn("dealership")
    const shop = await signIn("workshop")
    const theirs = await uploadBanner(shop)
    const refused = await book(dealer, {
      creative: { imageUrl: theirs, copy },
    })
    expect(refused.status).toBe(422)
    expect(await refused.json()).toMatchObject({
      fields: { "creative.imageUrl": "validation.url" },
    })
    const url = await uploadBanner(dealer)
    const body = { creative: { imageUrl: url, copy } }
    expect((await book(dealer, body)).status).toBe(200)
    expect((await book(dealer, body)).status).toBe(422)
  })

  test("is 422 for a link that is not the advertiser's, 403 for a buyer, 401 signed out", async () => {
    const dealer = await signIn("dealership")
    const wrong = await book(dealer, { href: "/dealerships/someone-else" })
    expect(wrong.status).toBe(422)
    expect(await wrong.json()).toMatchObject({
      fields: { href: "validation.ad_target" },
    })
    const buyer = await signIn("user")
    expect((await book(buyer)).status).toBe(403)
    expect((await req("/campaigns", { method: "POST" })).status).toBe(401)
    expect(await db.$count(campaigns)).toBe(seeded.campaigns.length)
  })

  test("is 422 for a page off sale or dates already over", async () => {
    const dealer = await signIn("dealership")
    await db
      .update(adPages)
      .set({ enabled: false })
      .where(eq(adPages.id, "home_top"))
    expect((await book(dealer)).status).toBe(422)
    expect(
      (await book(dealer, { pages: ["search_car"], startDate: "2020-01-06" }))
        .status
    ).toBe(422)
  })
})
