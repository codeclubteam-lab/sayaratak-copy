import { beforeEach, describe, expect, test } from "bun:test"
import { asc, eq, ilike, sql } from "drizzle-orm"

import { drafts } from "~/modules/account/account.tables"
import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { listingMedia, listingStats, listings } from "./listings.tables"

const seeded = buildSeed()
const withVideo = seeded.listings.find((l) =>
  l.media.some((m) => m.type === "video")
)

beforeEach(resetDb)

describe("listing tables", () => {
  test("hold every mock listing with its counters and media", async () => {
    expect(await db.$count(listings)).toBe(seeded.listings.length)
    expect(await db.$count(listingStats)).toBe(seeded.listings.length)
    expect(await db.$count(listingMedia)).toBe(
      seeded.listings.reduce((n, l) => n + l.media.length, 0)
    )
  })

  test("keep media order, and a video's poster as an upload", async () => {
    const media = await db
      .select({ id: uploads.id, url: uploads.url, poster: uploads.posterId })
      .from(listingMedia)
      .innerJoin(uploads, eq(uploads.id, listingMedia.uploadId))
      .where(eq(listingMedia.listingId, withVideo?.id ?? ""))
      .orderBy(asc(listingMedia.position))
    expect(media.map(({ id, url }) => ({ id, url }))).toEqual(
      withVideo?.media.map(({ id, url }) => ({ id, url })) ?? []
    )
    const video = media.at(-1)
    const [poster] = await db
      .select({ url: uploads.url })
      .from(uploads)
      .where(eq(uploads.id, video?.poster ?? ""))
    expect(poster?.url).toBe(withVideo?.media.at(-1)?.posterUrl ?? "")
  })

  test("store spec fields as an object and match q in the search text", async () => {
    const first = seeded.listings[0]
    const [row] = await db
      .select({ details: listings.details })
      .from(listings)
      .where(eq(listings.id, first?.id ?? ""))
    expect(row?.details.trim).toBe(first?.trim ?? null)
    expect(row?.details.features).toEqual(first?.features ?? [])
    const make = seeded.taxonomy.makes.find((m) => m.id === first?.makeId)
    const hits = await db
      .select({ id: listings.id })
      .from(listings)
      .where(ilike(listings.searchText, `%${make?.name.en.toLowerCase()}%`))
    expect(hits.map((h) => h.id)).toContain(first?.id ?? "")
  })

  test("keep a deleted account's listings ownerless, and drop media and counters with the listing", async () => {
    const mine = seeded.listings.find((l) => l.ownerUserId === "u-omar")
    await db.delete(user).where(eq(user.id, "u-omar"))
    expect(await db.$count(listings, eq(listings.id, mine?.id ?? ""))).toBe(1)
    await db.delete(listings).where(eq(listings.id, mine?.id ?? ""))
    expect(
      await db.$count(listingMedia, eq(listingMedia.listingId, mine?.id ?? ""))
    ).toBe(0)
    expect(
      await db.$count(listingStats, eq(listingStats.listingId, mine?.id ?? ""))
    ).toBe(0)
  })

  test("refuse a negative price, a half map pin and a malformed id", async () => {
    const id = seeded.listings[0]?.id ?? ""
    const update = (set: Partial<typeof listings.$inferInsert>) =>
      db
        .update(listings)
        .set(set)
        .where(eq(listings.id, id))
        .catch((error) => error.cause.constraint)
    expect(await update({ price: -1 })).toBe("listings_price")
    expect(await update({ lat: 15, lng: null })).toBe("listings_geo")
    expect(await update({ id: "L00001" })).toBe("listings_id")
  })

  test("keep one draft per user and key", async () => {
    const draft = {
      userId: "u-omar",
      key: "post",
      data: { title: "a" },
      updatedAt: new Date(),
    }
    await db.insert(drafts).values(draft)
    const error = await db
      .insert(drafts)
      .values(draft)
      .catch((error) => error)
    expect(error.cause.errno).toBe("23505")
    const [row] = await db.execute<{ kind: string }>(
      sql`select jsonb_typeof(data) as kind from drafts`
    )
    expect(row?.kind).toBe("object")
  })
})
