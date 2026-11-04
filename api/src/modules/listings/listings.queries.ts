import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  notInArray,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  type ListingRow,
  listingMedia,
  listings,
  listingStats,
  type NewListingRow,
} from "./listings.tables"

// A listing counts against the plan limit while pending or approved,
// available or reserved, and not expired (mock `listingUsage`).
export const LIVE_MODERATION = ["pending", "approved"] as const
export const LIVE_STATUS = ["available", "reserved"] as const

/** Marks every listing of the owner removed and returns their ids. */
export function updateRemovedOf(ex: Executor, ownerUserId: string) {
  return ex
    .update(listings)
    .set({ moderation: "removed" })
    .where(eq(listings.ownerUserId, ownerUserId))
    .returning({ id: listings.id })
    .then((rows) => rows.map((row) => row.id))
}

export function countPending(ex: Executor) {
  return ex.$count(listings, eq(listings.moderation, "pending"))
}

export function getListing(ex: Executor, id: string) {
  return ex
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .then(([row]) => row)
}

export function lockListing(ex: Executor, id: string) {
  return ex
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .for("update")
    .then(([row]) => row)
}

export function hasListing(ex: Executor, id: string) {
  return ex
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function countLiveOf(
  ex: Executor,
  owner: { ownerUserId: string; now: Date }
) {
  return ex.$count(
    listings,
    and(
      eq(listings.ownerUserId, owner.ownerUserId),
      inArray(listings.moderation, LIVE_MODERATION),
      inArray(listings.status, LIVE_STATUS),
      gt(listings.expiresAt, owner.now)
    )
  )
}

export async function insertListing(ex: Executor, row: NewListingRow) {
  const [inserted] = await ex.insert(listings).values(row).returning()
  // One row in, one row back; anything else is a driver fault.
  if (!inserted) throw new Error("insert into listings returned no row")
  await ex.insert(listingStats).values({ listingId: inserted.id })
  return inserted
}

export async function updateListing(
  ex: Executor,
  change: { id: string; set: Partial<NewListingRow> }
) {
  const [row] = await ex
    .update(listings)
    .set(change.set)
    .where(eq(listings.id, change.id))
    .returning()
  if (!row) throw new Error("update of listings returned no row")
  return row
}

export function deleteListing(ex: Executor, id: string) {
  return ex.delete(listings).where(eq(listings.id, id))
}

export function listStats(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select()
    .from(listingStats)
    .where(inArray(listingStats.listingId, ids))
}

/** Adds one to a listing counter; false when there is no such listing. */
export async function bumpStat(
  ex: Executor,
  id: string,
  counter: "views" | "phoneClicks" | "whatsappClicks"
) {
  const rows = await ex
    .update(listingStats)
    .set({ [counter]: sql`${listingStats[counter]} + 1` })
    .where(eq(listingStats.listingId, id))
    .returning({ id: listingStats.listingId })
  return rows.length > 0
}

/** Ids of every listing the user owns, whatever its state, in id order. */
export function listIdsOf(ex: Executor, ownerUserId: string) {
  return ex
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.ownerUserId, ownerUserId))
    .orderBy(asc(listings.id))
    .then((rows) => rows.map((row) => row.id))
}

export function listMediaIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select()
    .from(listingMedia)
    .where(inArray(listingMedia.listingId, ids))
    .orderBy(asc(listingMedia.listingId), asc(listingMedia.position))
}

export async function replaceMedia(
  ex: Executor,
  media: { listingId: string; uploadIds: string[] }
) {
  await ex
    .delete(listingMedia)
    .where(eq(listingMedia.listingId, media.listingId))
  if (media.uploadIds.length === 0) return
  await ex.insert(listingMedia).values(
    media.uploadIds.map((uploadId, position) => ({
      listingId: media.listingId,
      position,
      uploadId,
    }))
  )
}

export function listSimilar(
  ex: Executor,
  like: {
    row: Pick<ListingRow, "id" | "kind" | "intent" | "vehicleType" | "price">
    hiddenOwnerIds: string[]
    limit: number
  }
) {
  const { row } = like
  return (
    ex
      .select()
      .from(listings)
      .where(
        and(
          ne(listings.id, row.id),
          eq(listings.moderation, "approved"),
          eq(listings.status, "available"),
          eq(listings.kind, row.kind),
          eq(listings.intent, row.intent),
          row.vehicleType === null
            ? isNull(listings.vehicleType)
            : eq(listings.vehicleType, row.vehicleType),
          like.hiddenOwnerIds.length > 0
            ? notInArray(listings.ownerUserId, like.hiddenOwnerIds)
            : undefined
        )
      )
      // Raw SQL: Drizzle has no abs(); nearest price first, ties by id (the mock's array order).
      .orderBy(sql`abs(${listings.price} - ${row.price})`, asc(listings.id))
      .limit(like.limit)
  )
}
