import { and, eq, gte, inArray, type SQL } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { byIdNumber, listedWhere } from "./businesses.queries"
import {
  dealerships,
  mechanicCities,
  mechanics,
  mechanicSpecializations,
  workshopServices,
  workshops,
} from "./businesses.tables"

/** What every directory narrows by: where the business is and whether it is verified. */
export type Narrow = {
  hiddenOwnerIds: string[]
  city?: string
  verified: boolean
}

const TABLES = {
  dealership: dealerships,
  workshop: workshops,
  mechanic: mechanics,
}

/** Active dealerships (owner not hidden) in the mock's array order; rows the directory sorts and pages. */
export function listDealershipCandidates(ex: Executor, narrow: Narrow) {
  return ex
    .select({
      id: dealerships.id,
      ownerUserId: dealerships.ownerUserId,
      name: dealerships.name,
      createdAt: dealerships.createdAt,
    })
    .from(dealerships)
    .where(
      and(
        listedWhere(dealerships, narrow.hiddenOwnerIds),
        narrow.city ? eq(dealerships.cityId, narrow.city) : undefined,
        narrow.verified ? eq(dealerships.verified, true) : undefined
      )
    )
    .orderBy(...byIdNumber(dealerships))
}

/** Active workshops; `service` keeps those offering that service template. Pin and hours come along for "nearest" and "open now". */
export function listWorkshopCandidates(
  ex: Executor,
  narrow: Narrow & { service?: string }
) {
  const offering = narrow.service
    ? inArray(
        workshops.id,
        ex
          .select({ id: workshopServices.workshopId })
          .from(workshopServices)
          .where(eq(workshopServices.templateId, narrow.service))
      )
    : undefined
  return ex
    .select({
      id: workshops.id,
      name: workshops.name,
      createdAt: workshops.createdAt,
      lat: workshops.lat,
      lng: workshops.lng,
      hours: workshops.hours,
    })
    .from(workshops)
    .where(
      and(
        listedWhere(workshops, narrow.hiddenOwnerIds),
        narrow.city ? eq(workshops.cityId, narrow.city) : undefined,
        narrow.verified ? eq(workshops.verified, true) : undefined,
        offering
      )
    )
    .orderBy(...byIdNumber(workshops))
}

/** Active mechanics; `city` is any city they serve, `specialization` any skill they have. */
export function listMechanicCandidates(
  ex: Executor,
  narrow: Narrow & {
    specialization?: string
    minYears: number
    available: boolean
  }
) {
  return ex
    .select({
      id: mechanics.id,
      ownerUserId: mechanics.ownerUserId,
      name: mechanics.name,
      createdAt: mechanics.createdAt,
      yearsOfExperience: mechanics.yearsOfExperience,
    })
    .from(mechanics)
    .where(
      and(
        listedWhere(mechanics, narrow.hiddenOwnerIds),
        narrow.city
          ? inArray(
              mechanics.id,
              ex
                .select({ id: mechanicCities.mechanicId })
                .from(mechanicCities)
                .where(eq(mechanicCities.cityId, narrow.city))
            )
          : undefined,
        narrow.specialization
          ? inArray(
              mechanics.id,
              ex
                .select({ id: mechanicSpecializations.mechanicId })
                .from(mechanicSpecializations)
                .where(
                  eq(
                    mechanicSpecializations.specializationId,
                    narrow.specialization
                  )
                )
            )
          : undefined,
        gteYears(narrow.minYears),
        narrow.verified ? eq(mechanics.verified, true) : undefined,
        narrow.available ? eq(mechanics.available, true) : undefined
      )
    )
    .orderBy(...byIdNumber(mechanics))
}

/** The id and owner of the active business with this slug, of the kind asked. */
export function getActiveBySlug(
  ex: Executor,
  find: { kind: keyof typeof TABLES; slug: string }
) {
  const table = TABLES[find.kind]
  return ex
    .select({ id: table.id, ownerUserId: table.ownerUserId })
    .from(table)
    .where(and(eq(table.slug, find.slug), eq(table.status, "active")))
    .then(([row]) => row)
}

function gteYears(years: number): SQL | undefined {
  return years > 0 ? gte(mechanics.yearsOfExperience, years) : undefined
}
