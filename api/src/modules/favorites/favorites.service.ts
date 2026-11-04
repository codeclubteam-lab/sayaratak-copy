import type { favoriteSortSchema } from "@sayaratak/shared/schemas/inputs"
import type { typeFilterSchema } from "@sayaratak/shared/schemas/listing"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"
import type { DayRange } from "~/shared/time/khartoum"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as listings from "~/modules/listings/listings.read.service"
import * as stats from "~/modules/listings/listings.stats.service"
import { toListings } from "~/modules/listings/listings.view.service"

import * as q from "./favorites.queries"

type Sort = z.infer<typeof favoriteSortSchema>
type TypeFilter = z.infer<typeof typeFilterSchema>

/** Favorites added to these listings inside the days (`null`: every listing). */
export function countNewFavorites(
  ex: Executor,
  listingIds: string[] | null,
  days: DayRange
) {
  if (listingIds?.length === 0) return Promise.resolve(0)
  return q.countAddedIn(ex, listingIds, days)
}

/** `GET /me/favorite-ids`: the ids only, so every card can draw its heart. Empty when signed out. */
export async function getFavoriteIds(viewer: SessionUser | null) {
  if (!viewer) return []
  return (await q.listOf(db, viewer.id)).map((saved) => saved.listingId)
}

/**
 * `GET /favorites`: the user's saved listings, newest saved first by default.
 * A listing nobody can open any more (not approved, owner banned, business
 * suspended, sold or rented) still comes back, flagged `unavailable`, so the
 * person can remove it. `type` is a vehicle type or "part".
 */
export async function listFavorites(
  user: SessionUser,
  find: { type?: TypeFilter; sort: Sort; page: number; pageSize: number }
) {
  const saved = await q.listOf(db, user.id)
  const rows = await listings.getRowsByIds(
    db,
    saved.map((s) => s.listingId)
  )
  const savedAt = new Map(saved.map((s) => [s.listingId, s.savedAt]))
  const at = (id: string) => savedAt.get(id)?.getTime() ?? 0
  const { type } = find
  const matching = rows
    .filter(
      (row) =>
        !type ||
        (type === "part" ? row.kind === "part" : row.vehicleType === type)
    )
    .sort((a, b) => ORDER[find.sort](a.price, b.price) || at(b.id) - at(a.id))
  const pageRows = matching.slice(
    (find.page - 1) * find.pageSize,
    find.page * find.pageSize
  )
  const hidden = new Set(await listings.listHiddenOwnerIds(db))
  const shown = await toListings(db, pageRows, user)
  return {
    items: pageRows.flatMap((row, i) => {
      const listing = shown[i]
      const at = savedAt.get(row.id)
      if (!listing || !at) return []
      return {
        ...listing,
        savedAt: at.toISOString(),
        unavailable:
          row.moderation !== "approved" ||
          (!!row.ownerUserId && hidden.has(row.ownerUserId)) ||
          row.status === "sold" ||
          row.status === "rented",
      }
    }),
    total: matching.length,
    page: find.page,
    pageSize: find.pageSize,
  }
}

// ponytail: sorts in memory, one user's list is short; move to SQL past about a thousand favorites.
const ORDER: Record<Sort, (a: number, b: number) => number> = {
  recent: () => 0,
  price_asc: (a, b) => a - b,
  price_desc: (a, b) => b - a,
}

/**
 * `POST /favorites`: saves a listing of any state (404 for an unknown id);
 * saving twice changes nothing. The saved-by counter moves with the row.
 */
export async function addFavorite(user: SessionUser, listingId: string) {
  await transaction(async (tx) => {
    if (!(await stats.hasListing(tx, listingId))) fail.notFound()
    const added = await q.insert(tx, {
      userId: user.id,
      listingId,
      createdAt: clock.now(),
    })
    if (added) await stats.moveFavorites(tx, [listingId], 1)
  })
}

/** `DELETE /favorites/:listingId` (one) and `DELETE /favorites` (all): removing what is not saved changes nothing. */
export async function removeFavorites(user: SessionUser, listingId?: string) {
  await transaction(async (tx) => {
    const removed = await q.remove(tx, { userId: user.id, listingId })
    await stats.moveFavorites(tx, removed, -1)
  })
}
