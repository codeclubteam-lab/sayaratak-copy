import { and, asc, eq, inArray, ne, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { savedSearches } from "./saved-searches.tables"

export type NewSavedSearchRow = typeof savedSearches.$inferInsert

/** The user's searches, the oldest first as the mock lists them (new ones last). */
export function listOf(ex: Executor, userId: string) {
  return ex
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(asc(savedSearches.createdAt), asc(savedSearches.id))
}

export async function getOf(
  ex: Executor,
  find: { id: string; userId: string }
) {
  const [row] = await ex
    .select()
    .from(savedSearches)
    .where(
      and(eq(savedSearches.id, find.id), eq(savedSearches.userId, find.userId))
    )
  return row
}

export async function insert(ex: Executor, row: NewSavedSearchRow) {
  const [saved] = await ex.insert(savedSearches).values(row).returning()
  return saved
}

export async function update(
  ex: Executor,
  id: string,
  set: Partial<NewSavedSearchRow>
) {
  const [row] = await ex
    .update(savedSearches)
    .set(set)
    .where(eq(savedSearches.id, id))
    .returning()
  return row
}

export function remove(ex: Executor, id: string) {
  return ex.delete(savedSearches).where(eq(savedSearches.id, id))
}

/** Searches with alerts on, of everyone but the listing's owner (`null`: no owner to leave out). */
export function listAlertingExcept(ex: Executor, ownerUserId: string | null) {
  return ex
    .select({
      id: savedSearches.id,
      userId: savedSearches.userId,
      params: savedSearches.params,
    })
    .from(savedSearches)
    .where(
      and(
        eq(savedSearches.alerts, true),
        ownerUserId ? ne(savedSearches.userId, ownerUserId) : undefined
      )
    )
}

/** One more new match for each of these searches. */
export function bumpNewCount(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve()
  return ex
    .update(savedSearches)
    .set({ newCount: sql`${savedSearches.newCount} + 1` })
    .where(inArray(savedSearches.id, ids))
}
