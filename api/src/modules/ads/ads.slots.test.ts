import { beforeEach, describe, expect, test } from "bun:test"
import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import { campaignSchema } from "@sayaratak/shared/schemas/ads"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { payments } from "~/modules/payments/payments.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { fileOf, postPayment, postUpload } from "../../../tests/files"
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

// Seed: camp-1 (u-dealer, approved) holds search_car, search_truck and home_middle from 3 days ago
// for 2 weeks; camp-2 (u-workshop, under review) holds listing_detail and directory_workshops from
// tomorrow for 1 week. Every page has 3 slots.
const seeded = buildSeed()
const slugOf = (owner: "u-dealer" | "u-workshop") =>
  owner === "u-dealer"
    ? `/dealerships/${seeded.dealerships.find((d) => d.ownerId === owner)?.slug}`
    : `/workshops/${seeded.workshops.find((w) => w.ownerId === owner)?.slug}`
const DAY_MS = 86_400_000
const today = new Date().toISOString().slice(0, 10)
const copy = {
  ar: { heading: "عنوان", body: "نص", cta: "زر" },
  en: { heading: "Heading", body: "Text", cta: "Go" },
}
const receipt = {
  itemType: "campaign",
  payerName: "Ali Hassan",
  transactionRef: "TX12345",
}

beforeEach(resetDb)

const setSlots = (page: "home_top" | "search_car", slots: number) =>
  db.update(adPages).set({ slots }).where(eq(adPages.id, page))
async function book(
  who: SignedIn,
  owner: "u-dealer" | "u-workshop",
  over = {}
) {
  const media = await expectSchema(
    await postUpload(who, { file: fileOf("jpeg") }),
    mediaSchema
  )
  return call(who, "/campaigns", {
    method: "POST",
    body: {
      creative: { imageUrl: media.url, copy },
      href: slugOf(owner),
      pages: ["home_top"],
      startDate: today,
      weeks: 1,
      ...over,
    },
  })
}
async function bookOk(who: SignedIn, owner: "u-dealer" | "u-workshop") {
  return expectSchema(await book(who, owner), campaignSchema)
}

describe("a campaign's slots", () => {
  test("book is 409 page_full only for the dates a page is held", async () => {
    const dealer = await signIn("dealership")
    await setSlots("search_car", 1)
    const full = await book(dealer, "u-dealer", { pages: ["search_car"] })
    expect(full.status).toBe(409)
    expect(await full.json()).toMatchObject({ code: "page_full" })
    const later = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10)
    expect(
      (
        await book(dealer, "u-dealer", {
          pages: ["search_car"],
          startDate: later,
        })
      ).status
    ).toBe(200)
  })

  test("a receipt is 409 page_full when the pages filled since booking, and stores nothing", async () => {
    const dealer = await signIn("dealership")
    const campaign = await bookOk(dealer, "u-dealer")
    await setSlots("home_top", 1)
    await db
      .update(campaigns)
      .set({
        pages: ["home_top"],
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 7 * DAY_MS),
      })
      .where(eq(campaigns.id, "camp-2"))
    const files = await db.$count(uploads)
    const sent = await postPayment(dealer, { ...receipt, itemId: campaign.id })
    expect(sent.status).toBe(409)
    expect(await sent.json()).toMatchObject({ code: "page_full" })
    expect(await db.$count(uploads)).toBe(files)
    expect(await db.$count(payments, eq(payments.itemId, campaign.id))).toBe(0)
    const [row] = await db
      .select({ status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id))
    expect(row?.status).toBe("pending_payment")
  })

  test("the last slot goes to one of two receipts sent together", async () => {
    const dealer = await signIn("dealership")
    const shop = await signIn("workshop")
    await setSlots("home_top", 1)
    const a = await bookOk(dealer, "u-dealer")
    const b = await bookOk(shop, "u-workshop")
    const results = await Promise.all([
      postPayment(dealer, { ...receipt, itemId: a.id }),
      postPayment(shop, { ...receipt, itemId: b.id }),
    ])
    expect(results.map((res) => res.status).sort()).toEqual([200, 409])
    const [paid] = results.filter((res) => res.status === 200)
    if (!paid) throw new Error("one receipt should have been accepted")
    expect((await expectSchema(paid, paymentSchema)).status).toBe(
      "pending_review"
    )
    expect(
      await db.$count(campaigns, eq(campaigns.status, "under_review"))
    ).toBe(
      seeded.campaigns.filter((c) => c.status === "under_review").length + 1
    )
  })
})

describe("GET /ads", () => {
  const ask = async (page: string) =>
    expectSchema(await req(`/ads?page=${page}`), z.array(bannerSchema))

  test("serves a running campaign as a sponsored banner named after the advertiser", async () => {
    const [banner] = await ask("search_car")
    expect(banner).toMatchObject({
      id: "camp-1",
      sponsored: true,
      placement: "search_top",
      href: slugOf("u-dealer"),
    })
    const dealership = seeded.dealerships.find((d) => d.ownerId === "u-dealer")
    expect(banner?.copy?.en.eyebrow).toBe(dealership?.name.en)
    expect(banner?.copy?.ar.eyebrow).toBe(dealership?.name.ar)
    expect(await ask("home_top")).toEqual([])
    expect(await ask("nope")).toEqual([])
  })

  test("serves nothing once the campaign has ended or is not approved", async () => {
    await db
      .update(campaigns)
      .set({
        endsAt: new Date(Date.now() - 1000),
        startsAt: new Date(Date.now() - 3 * DAY_MS),
      })
      .where(eq(campaigns.id, "camp-1"))
    expect(await ask("search_car")).toEqual([])
    await db
      .update(campaigns)
      .set({
        status: "approved",
        pages: ["search_car"],
        startsAt: new Date(Date.now() - DAY_MS),
      })
      .where(eq(campaigns.id, "camp-2"))
    expect((await ask("search_car")).map((b) => b.id)).toEqual(["camp-2"])
  })

  test("picks at random among the running campaigns of a page", async () => {
    await db
      .update(campaigns)
      .set({
        status: "approved",
        pages: ["search_car"],
        startsAt: new Date(Date.now() - DAY_MS),
      })
      .where(eq(campaigns.id, "camp-2"))
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++)
      for (const b of await ask("search_car")) seen.add(b.id)
    expect([...seen].sort()).toEqual(["camp-1", "camp-2"])
  })
})
