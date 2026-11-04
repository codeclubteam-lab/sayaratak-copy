import { parseListingId } from "@sayaratak/shared/lib/slug"

import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"

import * as q from "./listings.queries"
import { listByIds } from "./listings.search.queries"
import * as subjects from "./listings.subject.queries"
import {
  type ListingRow,
  toListings,
  toOneListing,
} from "./listings.view.service"

const SIMILAR_COUNT = 8

/**
 * One listing by its slug; only the trailing id counts, so an old slug still
 * opens it. Anyone sees a public one; a draft, pending, rejected or hidden
 * one only its owner and admins. Everyone else gets 404, as if it never was.
 */
export async function getListingBySlug(
  viewer: SessionUser | null,
  slug: string
) {
  const row = await q.getListing(db, parseListingId(slug))
  if (!row) fail.notFound()
  const mine =
    viewer && (viewer.id === row.ownerUserId || viewer.role === "admin")
  if (!mine && !(await isPublic(db, row))) fail.notFound()
  return toOneListing(db, row, viewer)
}

/** Up to 8 public, available listings of the same kind, intent and type, nearest in price first. */
export async function listSimilar(viewer: SessionUser | null, id: string) {
  const row = await q.getListing(db, id)
  if (!row) fail.notFound()
  const rows = await q.listSimilar(db, {
    row,
    hiddenOwnerIds: await listHiddenOwnerIds(db),
    limit: SIMILAR_COUNT,
  })
  return toListings(db, rows, viewer)
}

/**
 * The slug and title of the owner's public listings (approved, owner not
 * hidden), in id order, at most `limit`: what a banner may link to.
 */
export async function listPublicLinksOf(
  ex: Executor,
  find: { ownerUserId: string; limit: number }
) {
  if ((await listHiddenOwnerIds(ex)).includes(find.ownerUserId)) return []
  return subjects.listApprovedLinks(ex, find)
}

/** Listings by id, in any state, in the order of `ids`; unknown ids are left out. */
export function getRowsByIds(ex: Executor, ids: string[]) {
  return listByIds(ex, ids)
}

/**
 * Owners whose listings are off the public site: banned accounts and
 * suspended businesses (mock `isPublic`). A short list, so search passes it
 * into SQL as `NOT IN`.
 */
export async function listHiddenOwnerIds(ex: Executor) {
  // Two independent reads.
  const [banned, suspended] = await Promise.all([
    auth.listBannedIds(ex),
    businesses.listSuspendedOwnerIds(ex),
  ])
  return [...new Set([...banned, ...suspended])]
}

async function isPublic(ex: Executor, row: ListingRow) {
  if (row.moderation !== "approved") return false
  if (!row.ownerUserId) return true
  return !(await listHiddenOwnerIds(ex)).includes(row.ownerUserId)
}
