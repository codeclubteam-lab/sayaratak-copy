import { beforeEach, describe, expect, test } from "bun:test"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { settings } from "~/modules/content/content.tables"
import { listings } from "~/modules/listings/listings.tables"
import { notifications } from "~/modules/notifications/notifications.tables"

import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
import { carBody, send, uploadPhotos } from "../../../tests/listings"
import { savedSearches } from "./saved-searches.tables"

// A new Toyota car for sale in Khartoum (the test's `carBody`) against four searches of u-omar.
const search = (id: string, params: object, alerts = true) => ({
  id,
  userId: "u-omar",
  name: id,
  alerts,
  newCount: 0,
  createdAt: new Date(),
  params: searchParamsSchema.parse({ kind: "vehicle", ...params }),
})
const newCountOf = async (id: string) =>
  (await db.select().from(savedSearches).where(eq(savedSearches.id, id)))[0]
    ?.newCount

beforeEach(async () => {
  await resetDb()
  await db.delete(savedSearches)
  await db
    .insert(savedSearches)
    .values([
      search("hit", { make: "toyota", city: "khartoum" }),
      search("quiet", { make: "toyota" }, false),
      search("other-make", { make: "nissan" }),
      search("owner", { make: "toyota" }),
    ])
  // The dealership posting the listing also keeps a search of its own.
  await db
    .update(savedSearches)
    .set({ userId: "u-dealer" })
    .where(eq(savedSearches.id, "owner"))
})

const noticesOf = (id: string) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, id),
        eq(notifications.type, "saved_search_match")
      )
    )
// The seed already holds some of these notices; a test counts only the new ones.
let seededNotices = new Set<string>()
let dealerNotices = 0
beforeEach(async () => {
  seededNotices = new Set((await noticesOf("u-omar")).map((n) => n.id))
  dealerNotices = (await noticesOf("u-dealer")).length
})

const post = async (as: Awaited<ReturnType<typeof signIn>>) =>
  expectSchema(
    await send(as, "/listings", {
      method: "POST",
      body: carBody(await uploadPhotos(as)),
    }),
    listingSchema
  )

describe("a listing that becomes public feeds the saved searches", () => {
  test("an auto-approved listing adds a new match to each alerting search it fits, not the owner's, not a silent one", async () => {
    await db.update(settings).set({ autoApproveVerifiedDealers: true })
    const listing = await post(await signIn("dealership"))
    expect(listing.moderation).toBe("approved")
    expect(await newCountOf("hit")).toBe(1)
    expect(await newCountOf("quiet")).toBe(0)
    expect(await newCountOf("other-make")).toBe(0)
    expect(await newCountOf("owner")).toBe(0)
    // One notice per person, not per search: u-omar's searches "hit" only; the owner hears nothing.
    const [fresh] = (await noticesOf("u-omar")).filter(
      (n) => !seededNotices.has(n.id)
    )
    expect(fresh).toMatchObject({
      href: `/listing/${listing.slug}`,
      body: { ar: listing.title, en: listing.title },
    })
    expect(await noticesOf("u-omar")).toHaveLength(seededNotices.size + 1)
    expect(await noticesOf("u-dealer")).toHaveLength(dealerNotices)
  })

  test("a listing that waits for review feeds nothing until an admin approves it", async () => {
    await db.update(settings).set({ autoApproveVerifiedDealers: false })
    const listing = await post(await signIn("dealership"))
    expect(listing.moderation).toBe("pending")
    expect(await newCountOf("hit")).toBe(0)
    const admin = await signIn("admin")
    await send(admin, `/listings/${listing.id}`, {
      method: "PATCH",
      body: { moderation: "approved" },
    })
    expect(await newCountOf("hit")).toBe(1)
    // Saved again while approved: no new match.
    await send(admin, `/listings/${listing.id}`, {
      method: "PATCH",
      body: { moderation: "approved" },
    })
    expect(await newCountOf("hit")).toBe(1)
    expect(
      (await db.select().from(listings).where(eq(listings.id, listing.id)))[0]
        ?.moderation
    ).toBe("approved")
  })
})
