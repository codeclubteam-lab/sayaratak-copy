import { and, asc, desc, eq, inArray } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import { type DayRange, withinDays } from "~/shared/time/khartoum"

import { favorites } from "./favorites.tables"

/** Favorites added inside the days to these listings; `null` means every listing. */
export function countAddedIn(
  ex: Executor,
  listingIds: string[] | null,
  days: DayRange
) {
  return ex.$count(
    favorites,
    and(
      withinDays(favorites.createdAt, days),
      listingIds ? inArray(favorites.listingId, listingIds) : undefined
    )
  )
}

/** The user's saved listings with the day each was saved, newest first. */
export function listOf(ex: Executor, userId: string) {
  return ex
    .select({ listingId: favorites.listingId, savedAt: favorites.createdAt })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt), asc(favorites.listingId))
}

/** Saves a listing; false when the user already had it. */
export async function insert(
  ex: Executor,
  row: { userId: string; listingId: string; createdAt: Date }
) {
  const saved = await ex
    .insert(favorites)
    .values(row)
    .onConflictDoNothing()
    .returning({ listingId: favorites.listingId })
  return saved.length > 0
}

/** Removes the user's favorite of one listing, or of all when `listingId` is left out; the ids that were really removed. */
export async function remove(
  ex: Executor,
  find: { userId: string; listingId?: string }
) {
  const rows = await ex
    .delete(favorites)
    .where(
      and(
        eq(favorites.userId, find.userId),
        find.listingId ? eq(favorites.listingId, find.listingId) : undefined
      )
    )
    .returning({ listingId: favorites.listingId })
  return rows.map((row) => row.listingId)
}
