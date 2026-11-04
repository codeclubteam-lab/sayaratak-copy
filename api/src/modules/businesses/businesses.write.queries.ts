import { eq } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  dealerships,
  mechanicCities,
  mechanics,
  mechanicSpecializations,
  workshopImages,
  workshopServices,
  workshops,
} from "./businesses.tables"

export type NewDealershipRow = typeof dealerships.$inferInsert
export type NewWorkshopRow = typeof workshops.$inferInsert
export type NewMechanicRow = typeof mechanics.$inferInsert

const SLUG_TABLES = {
  dealership: dealerships,
  workshop: workshops,
  mechanic: mechanics,
}

/** Whether a profile of this kind already has the slug (slugs are unique per kind). */
export function hasSlug(
  ex: Executor,
  find: { kind: keyof typeof SLUG_TABLES; slug: string }
) {
  const table = SLUG_TABLES[find.kind]
  return ex
    .select({ id: table.id })
    .from(table)
    .where(eq(table.slug, find.slug))
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function insertDealership(ex: Executor, row: NewDealershipRow) {
  return ex.insert(dealerships).values(row)
}

export function insertWorkshop(ex: Executor, row: NewWorkshopRow) {
  return ex.insert(workshops).values(row)
}

export function insertMechanic(ex: Executor, row: NewMechanicRow) {
  return ex.insert(mechanics).values(row)
}

export function insertServices(
  ex: Executor,
  rows: (typeof workshopServices.$inferInsert)[]
) {
  if (rows.length === 0) return Promise.resolve([])
  return ex.insert(workshopServices).values(rows)
}

export function insertMechanicCities(
  ex: Executor,
  rows: (typeof mechanicCities.$inferInsert)[]
) {
  if (rows.length === 0) return Promise.resolve([])
  return ex.insert(mechanicCities).values(rows)
}

export function insertMechanicSpecializations(
  ex: Executor,
  rows: (typeof mechanicSpecializations.$inferInsert)[]
) {
  if (rows.length === 0) return Promise.resolve([])
  return ex.insert(mechanicSpecializations).values(rows)
}

export type BusinessRef = { kind: keyof typeof SLUG_TABLES; id: string }

/** Takes the business row's lock until the transaction ends, so parallel edits of one business queue up. */
export function lockBusiness(ex: Executor, ref: BusinessRef) {
  const table = SLUG_TABLES[ref.kind]
  return ex
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, ref.id))
    .for("update")
}

export function updateDealership(
  ex: Executor,
  id: string,
  set: Partial<NewDealershipRow>
) {
  return ex.update(dealerships).set(set).where(eq(dealerships.id, id))
}

export function updateWorkshop(
  ex: Executor,
  id: string,
  set: Partial<NewWorkshopRow>
) {
  return ex.update(workshops).set(set).where(eq(workshops.id, id))
}

export function updateMechanic(
  ex: Executor,
  id: string,
  set: Partial<NewMechanicRow>
) {
  return ex.update(mechanics).set(set).where(eq(mechanics.id, id))
}

/** A workshop's photos in the owner's order, replaced as a whole. */
export async function replaceWorkshopImages(
  ex: Executor,
  workshopId: string,
  uploadIds: string[]
) {
  await ex
    .delete(workshopImages)
    .where(eq(workshopImages.workshopId, workshopId))
  if (uploadIds.length === 0) return
  await ex.insert(workshopImages).values(
    uploadIds.map((uploadId, position) => ({
      workshopId,
      position,
      uploadId,
    }))
  )
}

/** A mechanic's served cities in the owner's order, replaced as a whole. */
export async function replaceMechanicCities(
  ex: Executor,
  mechanicId: string,
  cityIds: string[]
) {
  await ex
    .delete(mechanicCities)
    .where(eq(mechanicCities.mechanicId, mechanicId))
  await insertMechanicCities(
    ex,
    cityIds.map((cityId, position) => ({ mechanicId, cityId, position }))
  )
}

/** A mechanic's skills in the owner's order, replaced as a whole. */
export async function replaceMechanicSpecializations(
  ex: Executor,
  mechanicId: string,
  specializationIds: string[]
) {
  await ex
    .delete(mechanicSpecializations)
    .where(eq(mechanicSpecializations.mechanicId, mechanicId))
  await insertMechanicSpecializations(
    ex,
    specializationIds.map((specializationId, position) => ({
      mechanicId,
      specializationId,
      position,
    }))
  )
}
