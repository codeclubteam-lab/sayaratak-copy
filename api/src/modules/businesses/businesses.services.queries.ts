import { and, asc, eq, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { workshopServices } from "./businesses.tables"

type NewServiceRow = typeof workshopServices.$inferInsert

/** A workshop's services in the owner's order. */
export function listServiceRows(ex: Executor, workshopId: string) {
  return ex
    .select()
    .from(workshopServices)
    .where(eq(workshopServices.workshopId, workshopId))
    .orderBy(asc(workshopServices.position))
}

export function getServiceRow(
  ex: Executor,
  find: { workshopId: string; id: string }
) {
  return ex
    .select()
    .from(workshopServices)
    .where(
      and(
        eq(workshopServices.workshopId, find.workshopId),
        eq(workshopServices.id, find.id)
      )
    )
    .then(([row]) => row)
}

export function insertServiceRow(ex: Executor, row: NewServiceRow) {
  return ex.insert(workshopServices).values(row)
}

export function updateServiceRow(
  ex: Executor,
  id: string,
  set: Partial<NewServiceRow>
) {
  return ex.update(workshopServices).set(set).where(eq(workshopServices.id, id))
}

export function deleteServiceRow(
  ex: Executor,
  find: { workshopId: string; id: string }
) {
  return ex
    .delete(workshopServices)
    .where(
      and(
        eq(workshopServices.workshopId, find.workshopId),
        eq(workshopServices.id, find.id)
      )
    )
}

/**
 * Moves every position of the workshop up by `by`. Positions are unique per
 * workshop and checked row by row, so a reorder first moves all rows out of
 * the way and then places each one.
 */
export function shiftServicePositions(
  ex: Executor,
  shift: { workshopId: string; by: number }
) {
  return ex
    .update(workshopServices)
    .set({ position: sql`${workshopServices.position} + ${shift.by}` })
    .where(eq(workshopServices.workshopId, shift.workshopId))
}
