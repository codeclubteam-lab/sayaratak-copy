import { beforeEach, describe, expect, test } from "bun:test"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { files } from "~/shared/files/store"
import { settings } from "~/modules/content/content.tables"
import { subscriptions } from "~/modules/plans/plans.tables"
import { uploads } from "~/modules/uploads/uploads.tables"

import { carBody, send, uploadPhotos } from "../../../tests/listings"
import { DEMO_IDS, expectSchema, resetDb, signIn } from "../../../tests/helpers"
import { listings } from "./listings.tables"

beforeEach(async () => {
  await resetDb()
  await db.update(settings).set({ individualSubscriptionsEnabled: false })
})

async function omarsListing(moderation: "approved" | "rejected") {
  const [row] = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.ownerUserId, DEMO_IDS.user),
        eq(listings.moderation, moderation)
      )
    )
    .limit(1)
  if (!row) throw new Error(`the seed gives Omar no ${moderation} listing`)
  return row
}

const patch = (
  as: Awaited<ReturnType<typeof signIn>>,
  id: string,
  body: unknown
) => send(as, `/listings/${id}`, { method: "PATCH", body })

describe("PATCH /listings/:id", () => {
  test("returns 404 for an unknown id and 403 forbidden to someone else", async () => {
    const row = await omarsListing("approved")
    const dealer = await signIn("dealership")
    expect((await patch(dealer, "lzzzzz", { price: 1 })).status).toBe(404)
    const other = await patch(dealer, row.id, { price: 1 })
    expect(other.status).toBe(403)
    expect(await other.json()).toMatchObject({ code: "forbidden" })
  })

  test("returns 403 when the owner sets moderation; an admin may", async () => {
    const row = await omarsListing("approved")
    expect(
      (await patch(await signIn("user"), row.id, { moderation: "approved" }))
        .status
    ).toBe(403)
    const admin = await patch(await signIn("admin"), row.id, {
      moderation: "rejected",
    })
    expect((await expectSchema(admin, listingSchema)).moderation).toBe(
      "rejected"
    )
  })

  test("a new title sends an approved listing back to review and rebuilds the slug; a price does not", async () => {
    const row = await omarsListing("approved")
    const omar = await signIn("user")
    const priced = await expectSchema(
      await patch(omar, row.id, { price: 5 }),
      listingSchema
    )
    expect(priced).toMatchObject({
      moderation: "approved",
      price: 5,
      slug: row.slug,
    })
    const titled = await expectSchema(
      await patch(omar, row.id, { title: "Nissan Sunny 2012" }),
      listingSchema
    )
    expect(titled.moderation).toBe("pending")
    expect(titled.slug).toStartWith("nissan-sunny-2012-")
    expect(titled.slug.endsWith(`-${row.id}`)).toBe(true)
  })

  test("submit sends a rejected listing to review and clears the reason", async () => {
    const row = await omarsListing("rejected")
    const omar = await signIn("user")
    const photos = await uploadPhotos(omar)
    const listing = await expectSchema(
      await patch(omar, row.id, carBody(photos)),
      listingSchema
    )
    expect(listing).toMatchObject({
      moderation: "pending",
      rejectionReason: null,
    })
  })

  test("at the plan limit, submit is 403 limit_reached and the listing stays rejected", async () => {
    const row = await omarsListing("rejected")
    const omar = await signIn("user")
    await db
      .update(settings)
      .set({ individualSubscriptionsEnabled: true, freeListingLimit: 0 })
    // Without a subscription the free limit applies.
    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, DEMO_IDS.user))
    const res = await patch(omar, row.id, carBody(await uploadPhotos(omar)))
    expect(res.status).toBe(403)
    const [after] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, row.id))
    expect(after?.moderation).toBe("rejected")
    expect(after?.title).toBe(row.title)
  })

  test("new photos replace the old ones; the dropped files are deleted after the commit", async () => {
    const omar = await signIn("user")
    const first = await uploadPhotos(omar)
    const created = await expectSchema(
      await send(omar, "/listings", { method: "POST", body: carBody(first) }),
      listingSchema
    )
    const [keep] = first
    const [fresh] = await uploadPhotos(omar, 1)
    if (!keep || !fresh) throw new Error("no photos")
    const [dropped] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, first[1]?.id ?? ""))
    const listing = await expectSchema(
      await patch(omar, created.id, { media: [keep, fresh] }),
      listingSchema
    )
    expect(listing.media.map((m) => m.id)).toEqual([keep.id, fresh.id])
    expect(await db.$count(uploads, eq(uploads.id, first[1]?.id ?? ""))).toBe(0)
    const read = await files
      .read({ publicId: dropped?.cloudinaryId ?? "", mime: "image/jpeg" })
      .catch(() => null)
    expect(read).toBeNull()
  })
})
