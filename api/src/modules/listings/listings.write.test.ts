import { beforeEach, describe, expect, test } from "bun:test"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { eq, inArray } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { settings } from "~/modules/content/content.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { carBody, send, uploadPhotos } from "../../../tests/listings"
import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { listings } from "./listings.tables"

const DAY_MS = 86_400_000

beforeEach(async () => {
  await resetDb()
  // Room under any plan limit unless a test sets one.
  await db.update(settings).set({ individualSubscriptionsEnabled: false })
})

const create = (as: Awaited<ReturnType<typeof signIn>>, body: unknown) =>
  send(as, "/listings", { method: "POST", body })

describe("POST /listings", () => {
  test("returns 401 signed out and 403 forbidden for a workshop", async () => {
    const body = { title: "x", price: 1, cityId: "khartoum" }
    const out = await req("/listings", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
    expect(out.status).toBe(401)
    const workshop = await create(await signIn("workshop"), body)
    expect(workshop.status).toBe(403)
    expect(await workshop.json()).toMatchObject({ code: "forbidden" })
  })

  test("keeps an incomplete listing as a draft that expires after the setting's days", async () => {
    const res = await create(await signIn("user"), {
      title: "Half done",
      price: 1000,
      cityId: "khartoum",
    })
    expect(res.status).toBe(200)
    const listing = await expectSchema(res, listingSchema)
    const [setting] = await db.select().from(settings)
    expect(listing).toMatchObject({
      moderation: "draft",
      kind: "vehicle",
      intent: "sale",
      condition: "used",
      owner: { id: DEMO_IDS.user, type: "user", profileSlug: null },
      contact: { showPhone: true, methods: ["call", "chat"] },
      promotions: [],
      stats: { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
    })
    expect(listing.slug.endsWith(`-${listing.id}`)).toBe(true)
    const days =
      (Date.parse(listing.expiresAt) - Date.parse(listing.createdAt)) / DAY_MS
    expect(days).toBe(setting?.listingExpiryDays ?? 0)
  })

  test("sends a complete car to review with its photos, which become attached", async () => {
    const omar = await signIn("user")
    const photos = await uploadPhotos(omar)
    const listing = await expectSchema(
      await create(omar, carBody(photos)),
      listingSchema
    )
    expect(listing.moderation).toBe("pending")
    expect(listing.media).toEqual(photos)
    expect(listing.description).toEqual({
      ar: "Clean car, one owner, full service history.",
      en: "Clean car, one owner, full service history.",
    })
    const rows = await db
      .select()
      .from(uploads)
      .where(
        inArray(
          uploads.id,
          photos.map((p) => p.id)
        )
      )
    expect(rows.every((row) => row.attachedAt !== null)).toBe(true)
    const [row] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, listing.id))
    expect(row?.searchText).toContain("toyota")
    expect(row?.searchText).toContain("corolla")
  })

  test("returns 422 with the wizard's field keys for an incomplete submit", async () => {
    const omar = await signIn("user")
    const [photo] = await uploadPhotos(omar, 1)
    const res = await create(
      omar,
      carBody(photo ? [photo] : [], { year: null })
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      fields: { media: "validation.media_min", year: "validation.required" },
    })
  })

  test("returns 422 for an unknown city or a district of another city", async () => {
    const omar = await signIn("user")
    const city = await create(omar, {
      title: "x",
      price: 1,
      cityId: "atlantis",
    })
    expect(await city.json()).toMatchObject({
      fields: { cityId: "validation.required" },
    })
    const district = await create(omar, {
      title: "x",
      price: 1,
      cityId: "omdurman",
      districtId: "khartoum-riyadh",
    })
    expect(await district.json()).toMatchObject({
      fields: { districtId: "validation.required" },
    })
  })

  test("returns 422 on media for another person's photo or one already in use", async () => {
    const omar = await signIn("user")
    const [theirs] = await uploadPhotos(await signIn("dealership"), 1)
    const foreign = await create(omar, {
      title: "x",
      price: 1,
      cityId: "khartoum",
      media: [theirs],
    })
    expect(await foreign.json()).toMatchObject({
      fields: { media: "validation.required" },
    })
    const [mine] = await uploadPhotos(omar, 1)
    const first = await create(omar, {
      title: "x",
      price: 1,
      cityId: "khartoum",
      media: [mine],
    })
    expect(first.status).toBe(200)
    const again = await create(omar, {
      title: "y",
      price: 1,
      cityId: "khartoum",
      media: [mine],
    })
    expect(again.status).toBe(422)
  })

  test("a verified dealership is published at once when auto-approval is on", async () => {
    await db.update(settings).set({ autoApproveVerifiedDealers: true })
    const dealer = await signIn("dealership")
    const listing = await expectSchema(
      await create(dealer, carBody(await uploadPhotos(dealer))),
      listingSchema
    )
    expect(listing.moderation).toBe("approved")
    expect(listing.owner).toMatchObject({ type: "dealership", verified: true })
    expect(listing.owner.profileSlug).not.toBeNull()
  })
})
