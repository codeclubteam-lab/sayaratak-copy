import { asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { byIdNumber } from "./businesses.queries"
import {
  dealerships,
  mechanicCities,
  mechanics,
  workshops,
} from "./businesses.tables"

const TABLES = {
  dealership: dealerships,
  workshop: workshops,
  mechanic: mechanics,
}

type Kind = keyof typeof TABLES

export function count(ex: Executor, kind: Kind) {
  return ex.$count(TABLES[kind])
}

/** The newest profiles of one kind, ties in the mock's id order. */
export function listNewest(ex: Executor, find: { kind: Kind; limit: number }) {
  const table = TABLES[find.kind]
  return ex
    .select({ id: table.id, name: table.name, createdAt: table.createdAt })
    .from(table)
    .orderBy(desc(table.createdAt), ...byIdNumber(table), asc(table.id))
    .limit(find.limit)
}

/** Profiles of one kind whose name, in either language, holds the pattern. */
export function search(
  ex: Executor,
  find: { kind: Kind; pattern: string; limit: number }
) {
  const table = TABLES[find.kind]
  return ex
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(
      or(
        // Raw SQL: Drizzle has no `->>`; the bilingual name is jsonb `{ ar, en }`.
        ilike(sql`${table.name} ->> 'ar'`, find.pattern),
        ilike(sql`${table.name} ->> 'en'`, find.pattern)
      )
    )
    .orderBy(...byIdNumber(table))
    .limit(find.limit)
}

/** A dealership, workshop or mechanic is based in the city, or a mechanic serves it. */
export async function hasBusinessInCity(ex: Executor, cityId: string) {
  // Four independent one-row reads.
  const found = await Promise.all([
    ex
      .select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.cityId, cityId))
      .limit(1),
    ex
      .select({ id: workshops.id })
      .from(workshops)
      .where(eq(workshops.cityId, cityId))
      .limit(1),
    ex
      .select({ id: mechanics.id })
      .from(mechanics)
      .where(eq(mechanics.cityId, cityId))
      .limit(1),
    ex
      .select({ id: mechanicCities.mechanicId })
      .from(mechanicCities)
      .where(eq(mechanicCities.cityId, cityId))
      .limit(1),
  ])
  return found.some((rows) => rows.length > 0)
}

/** A dealership or workshop has the district. */
export async function hasBusinessInDistrict(ex: Executor, districtId: string) {
  // Two independent one-row reads.
  const found = await Promise.all([
    ex
      .select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.districtId, districtId))
      .limit(1),
    ex
      .select({ id: workshops.id })
      .from(workshops)
      .where(eq(workshops.districtId, districtId))
      .limit(1),
  ])
  return found.some((rows) => rows.length > 0)
}

/** The profile of each owner (all of them, or just `ownerIds`) with its city and verified badge, for announcements. */
export async function listOwnerProfiles(ex: Executor, ownerIds?: string[]) {
  // Three independent reads, one per kind.
  const kinds = await Promise.all(
    [dealerships, workshops, mechanics].map((table) =>
      ex
        .select({
          ownerUserId: table.ownerUserId,
          cityId: table.cityId,
          verified: table.verified,
        })
        .from(table)
        .where(ownerIds ? inArray(table.ownerUserId, ownerIds) : undefined)
    )
  )
  return kinds.flat()
}
