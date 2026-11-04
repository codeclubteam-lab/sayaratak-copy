import { inArray, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { listingStats } from "./listings.tables"

/** Moves the saved-by counter of each listing by `delta`, never below 0. */
export function bumpFavorites(ex: Executor, ids: string[], delta: 1 | -1) {
  if (ids.length === 0) return Promise.resolve()
  return ex
    .update(listingStats)
    .set({ favorites: sql`greatest(0, ${listingStats.favorites} + ${delta})` })
    .where(inArray(listingStats.listingId, ids))
}
