import type { Executor, Transaction } from "~/shared/db/tx"
import * as promotions from "~/modules/promotions/promotions.service"

import * as inventory from "./listings.inventory.queries"
import * as q from "./listings.queries"

/**
 * A deleted account's listings stay as rows, marked removed, so the admin
 * history keeps them (A2 "Account deletion"); their promotions end.
 */
export async function removeListingsOf(tx: Transaction, ownerUserId: string) {
  const ids = await q.updateRemovedOf(tx, ownerUserId)
  await promotions.endPromotionsOf(tx, ids)
}

/** Listings waiting in the admin moderation queue. */
export function countPendingListings(ex: Executor) {
  return q.countPending(ex)
}

/**
 * How many listings each owner has approved and still available, keyed by
 * owner id: the count a dealership page shows. Owners with none read 0.
 */
export async function countInventoryOf(ex: Executor, ownerUserIds: string[]) {
  const rows = await inventory.countAvailableByOwner(ex, ownerUserIds)
  const counts = new Map(ownerUserIds.map((id) => [id, 0]))
  for (const row of rows)
    if (row.ownerUserId) counts.set(row.ownerUserId, row.count)
  return counts
}

/** The owner, title and last bump of a listing, or undefined: what a promotion order names. */
export async function getListingHead(ex: Executor, id: string) {
  const row = await q.getListing(ex, id)
  return (
    row && {
      ownerUserId: row.ownerUserId,
      title: row.title,
      bumpedAt: row.bumpedAt,
    }
  )
}

/** A paid bump: the listing goes back to the top of the newest from `at`. */
export async function bumpListing(
  tx: Transaction,
  change: { id: string; at: Date }
) {
  await q.updateListing(tx, { id: change.id, set: { bumpedAt: change.at } })
}
