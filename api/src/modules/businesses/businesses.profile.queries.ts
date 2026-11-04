import { asc, inArray } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  dealerships,
  mechanicCities,
  mechanics,
  mechanicSpecializations,
  portfolioItems,
  workshopImages,
  workshopServices,
  workshops,
} from "./businesses.tables"

// Every list below answers nothing for an empty id list, without asking the database.
const none = () => Promise.resolve([])

export function listDealershipsByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return none()
  return ex.select().from(dealerships).where(inArray(dealerships.id, ids))
}

export function listWorkshopsByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return none()
  return ex.select().from(workshops).where(inArray(workshops.id, ids))
}

export function listMechanicsByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return none()
  return ex.select().from(mechanics).where(inArray(mechanics.id, ids))
}

/** Photos of the workshops, each workshop's in the order the owner arranged. */
export function listWorkshopImages(ex: Executor, workshopIds: string[]) {
  if (workshopIds.length === 0) return none()
  return ex
    .select()
    .from(workshopImages)
    .where(inArray(workshopImages.workshopId, workshopIds))
    .orderBy(asc(workshopImages.position))
}

export function listWorkshopServices(ex: Executor, workshopIds: string[]) {
  if (workshopIds.length === 0) return none()
  return ex
    .select()
    .from(workshopServices)
    .where(inArray(workshopServices.workshopId, workshopIds))
    .orderBy(asc(workshopServices.position))
}

export function listMechanicCities(ex: Executor, mechanicIds: string[]) {
  if (mechanicIds.length === 0) return none()
  return ex
    .select()
    .from(mechanicCities)
    .where(inArray(mechanicCities.mechanicId, mechanicIds))
    .orderBy(asc(mechanicCities.position))
}

export function listMechanicSpecializations(
  ex: Executor,
  mechanicIds: string[]
) {
  if (mechanicIds.length === 0) return none()
  return ex
    .select()
    .from(mechanicSpecializations)
    .where(inArray(mechanicSpecializations.mechanicId, mechanicIds))
    .orderBy(asc(mechanicSpecializations.position))
}

export function listPortfolio(ex: Executor, mechanicIds: string[]) {
  if (mechanicIds.length === 0) return none()
  return ex
    .select()
    .from(portfolioItems)
    .where(inArray(portfolioItems.mechanicId, mechanicIds))
    .orderBy(asc(portfolioItems.position))
}
