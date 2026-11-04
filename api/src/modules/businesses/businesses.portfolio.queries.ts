import { and, eq, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { portfolioItems } from "./businesses.tables"

type NewPortfolioRow = typeof portfolioItems.$inferInsert

export function getPortfolioRow(
  ex: Executor,
  find: { mechanicId: string; id: string }
) {
  return ex
    .select()
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.mechanicId, find.mechanicId),
        eq(portfolioItems.id, find.id)
      )
    )
    .then(([row]) => row)
}

export function insertPortfolioRow(ex: Executor, row: NewPortfolioRow) {
  return ex.insert(portfolioItems).values(row)
}

export function updatePortfolioRow(
  ex: Executor,
  id: string,
  set: Partial<NewPortfolioRow>
) {
  return ex.update(portfolioItems).set(set).where(eq(portfolioItems.id, id))
}

/** Deletes an item of the mechanic and answers the removed row, if there was one. */
export function deletePortfolioRow(
  ex: Executor,
  find: { mechanicId: string; id: string }
) {
  return ex
    .delete(portfolioItems)
    .where(
      and(
        eq(portfolioItems.mechanicId, find.mechanicId),
        eq(portfolioItems.id, find.id)
      )
    )
    .returning()
    .then(([row]) => row)
}

/**
 * Moves every position of the mechanic up by `by`. Positions are unique per
 * mechanic and checked row by row, so a reorder first moves all rows out of
 * the way and then places each one.
 */
export function shiftPortfolioPositions(
  ex: Executor,
  shift: { mechanicId: string; by: number }
) {
  return ex
    .update(portfolioItems)
    .set({ position: sql`${portfolioItems.position} + ${shift.by}` })
    .where(eq(portfolioItems.mechanicId, shift.mechanicId))
}
