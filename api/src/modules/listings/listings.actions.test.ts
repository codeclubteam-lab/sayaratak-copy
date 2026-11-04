import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { files } from "~/shared/files/store"
import { clock } from "~/shared/time/clock"
import { settings } from "~/modules/content/content.tables"
import { favorites } from "~/modules/favorites/favorites.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { carBody, send, uploadPhotos } from "../../../tests/listings"
import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import { listings } from "./listings.tables"

const DAY_MS = 86_400_000

beforeEach(async () => {
  await resetDb()
  await db.update(settings).set({ individualSubscriptionsEnabled: false })
})

async function newListing(as: Awaited<ReturnType<typeof signIn>>) {
  const res = await send(as, "/listings", {
    method: "POST",
    body: carBody(await uploadPhotos(as)),
  })
  return expectSchema(res, listingSchema)
}

describe("listing actions", () => {
  test("DELETE removes the listing, its favorites and its photo files", async () => {
    const omar = await signIn("user")
    const listing = await newListing(omar)
    await db.insert(favorites).values({
      userId: "u-dealer",
      listingId: listing.id,
      createdAt: new Date(),
    })
    const [photo] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, listing.media[0]?.id ?? ""))
    const res = await send(omar, `/listings/${listing.id}`, {
      method: "DELETE",
    })
    expect(await expectSchema(res, okSchema)).toEqual({ ok: true })
    expect(await db.$count(listings, eq(listings.id, listing.id))).toBe(0)
    expect(
      await db.$count(favorites, eq(favorites.listingId, listing.id))
    ).toBe(0)
    expect(await db.$count(uploads, eq(uploads.id, photo?.id ?? ""))).toBe(0)
    const read = await files
      .read({ publicId: photo?.cloudinaryId ?? "", mime: "image/jpeg" })
      .catch(() => null)
    expect(read).toBeNull()
  })

  test("only the owner or an admin may act: 403 forbidden otherwise", async () => {
    const listing = await newListing(await signIn("user"))
    const dealer = await signIn("dealership")
    for (const [method, path] of [
      ["DELETE", ""],
      ["POST", "/renew"],
      ["POST", "/duplicate"],
    ] as const) {
      const res = await send(dealer, `/listings/${listing.id}${path}`, {
        method,
      })
      expect(res.status).toBe(403)
    }
    const admin = await send(
      await signIn("admin"),
      `/listings/${listing.id}/renew`,
      { method: "POST" }
    )
    expect(admin.status).toBe(200)
  })

  test("status marks it reserved without touching its review state", async () => {
    const omar = await signIn("user")
    const listing = await newListing(omar)
    const res = await send(omar, `/listings/${listing.id}/status`, {
      method: "POST",
      body: { status: "reserved" },
    })
    expect(await expectSchema(res, listingSchema)).toMatchObject({
      status: "reserved",
      moderation: "pending",
    })
  })

  test("renew adds the setting's days to the later of now and the current end", async () => {
    const omar = await signIn("user")
    const listing = await newListing(omar)
    const [setting] = await db.select().from(settings)
    const days = (setting?.listingExpiryDays ?? 0) * DAY_MS
    const early = await expectSchema(
      await send(omar, `/listings/${listing.id}/renew`, { method: "POST" }),
      listingSchema
    )
    expect(Date.parse(early.expiresAt)).toBe(
      Date.parse(listing.expiresAt) + days
    )
    const later = new Date(Date.parse(early.expiresAt) + 10 * DAY_MS)
    const spy = spyOn(clock, "now").mockReturnValue(later)
    const late = await expectSchema(
      await send(omar, `/listings/${listing.id}/renew`, { method: "POST" }),
      listingSchema
    )
    spy.mockRestore()
    expect(Date.parse(late.expiresAt)).toBe(later.getTime() + days)
  })

  test("duplicate makes a fresh draft with the same photos; deleting the original keeps them", async () => {
    const omar = await signIn("user")
    const listing = await newListing(omar)
    const copy = await expectSchema(
      await send(omar, `/listings/${listing.id}/duplicate`, { method: "POST" }),
      listingSchema
    )
    expect(copy.id).not.toBe(listing.id)
    expect(copy).toMatchObject({
      moderation: "draft",
      status: "available",
      promotions: [],
      title: listing.title,
      stats: { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
    })
    expect(copy.media.map((m) => m.url)).toEqual(
      listing.media.map((m) => m.url)
    )
    expect(copy.media.map((m) => m.id)).not.toEqual(
      listing.media.map((m) => m.id)
    )
    await send(omar, `/listings/${listing.id}`, { method: "DELETE" })
    const [shared] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, copy.media[0]?.id ?? ""))
    expect(
      await files.read({
        publicId: shared?.cloudinaryId ?? "",
        mime: "image/jpeg",
      })
    ).toBeInstanceOf(Uint8Array)
  })
})
