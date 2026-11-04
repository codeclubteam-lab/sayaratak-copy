import type { Executor } from "~/shared/db/tx"
import { containing } from "~/shared/text/like"
import { clock } from "~/shared/time/clock"
import type { DayRange } from "~/shared/time/khartoum"

import * as q from "./listings.overview.queries"

/** Approved listings, and how many of them are vehicles (parts make up the rest). */
export async function countApproved(ex: Executor) {
  // Two independent reads.
  const [listings, vehicles] = await Promise.all([
    q.countApproved(ex),
    q.countApprovedVehicles(ex),
  ])
  return { listings, vehicles }
}

/** Listings created per Khartoum day, as a day to count map. */
export async function countCreatedPerDay(ex: Executor, days: DayRange) {
  const rows = await q.listCreatedPerDay(ex, days)
  return new Map(rows.map((row) => [row.day, row.count]))
}

/** Live listings (the ones counted against a plan limit) per owner; an owner with none is missing. */
export async function countLivePerOwner(ex: Executor, ownerUserIds: string[]) {
  const rows = await q.countLivePerOwner(ex, {
    ownerUserIds,
    now: clock.now(),
  })
  return new Map(rows.map((row) => [row.ownerUserId ?? "", row.count]))
}

/** Ids of the listings whose title holds `term` (lower case): the search of the admin promotions table. */
export function listIdsTitled(ex: Executor, term: string) {
  return q.listIdsTitled(ex, term)
}

/** The newest listings that were sent in, newest first, for the admin activity feed. */
export function listNewestSubmitted(ex: Executor, limit: number) {
  return q.listNewestSubmitted(ex, limit)
}

/** Up to `limit` listings whose title or id holds `term`, for the admin search. */
export function searchListings(
  ex: Executor,
  find: { term: string; limit: number }
) {
  return q.search(ex, { pattern: containing(find.term), limit: find.limit })
}

/**
 * The ids of the listings (drafts left out) of each owner, as an owner id to
 * ids map; an owner with none is missing.
 */
// ponytail: loads every id of the page's owners; a SQL count and join when one owner holds tens of thousands.
export async function listIdsPerOwner(ex: Executor, ownerIds: string[]) {
  const ids = new Map<string, string[]>()
  if (ownerIds.length === 0) return ids
  for (const row of await q.listIdsOfOwners(ex, ownerIds)) {
    if (!row.ownerUserId) continue
    ids.set(row.ownerUserId, [...(ids.get(row.ownerUserId) ?? []), row.id])
  }
  return ids
}

/**
 * Any listing, in any state, holds this city, district, make, model or part category: the
 * check before an admin deletes it. Example: `hasListingWith(db, { column: "makeId", id: "toyota" })`.
 */
export function hasListingWith(
  ex: Executor,
  find: { column: q.ListingPick; id: string }
) {
  return q.hasListingWith(ex, find)
}
