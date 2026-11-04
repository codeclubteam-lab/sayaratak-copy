import { and, asc, eq, like, ne, or, sql } from "drizzle-orm"
import type { PgColumn, PgTable } from "drizzle-orm/pg-core"

import type { Executor } from "~/shared/db/tx"

import {
  cities,
  countries,
  districts,
  makes,
  models,
  partCategories,
  type RowOf,
  vehicleTypes,
} from "./taxonomy.tables"
import type { TaxonomyType } from "./taxonomy.types"

// Every managed table has these two columns; the rest differs per list.
type Managed = PgTable & { id: PgColumn; position: PgColumn }

const TABLES: Record<TaxonomyType, Managed> = {
  cities,
  districts,
  makes,
  models,
  "vehicle-types": vehicleTypes,
  "part-categories": partCategories,
  countries,
}

// Drizzle cannot see through the lookup that a row has the shape of the table `type` names, so each query casts its rows to `RowOf`.
const tableOf = (type: TaxonomyType) => TABLES[type]

/** Every row of one list in list order, the ones of a turned-off country included. */
export function listRows<K extends TaxonomyType>(ex: Executor, type: K) {
  const table = tableOf(type)
  return ex
    .select()
    .from(table)
    .orderBy(asc(table.position))
    .then((rows) => rows as RowOf[K][])
}

/**
 * Serializes every admin write to one list until the transaction ends. Two admins adding
 * "Toyota" together then get "toyota" and "toyota-2", and two admins hiding the last two
 * countries together cannot both pass the "one stays shown" check.
 */
export async function lockList(ex: Executor, type: TaxonomyType) {
  // Transaction-level advisory lock on a hash of the list name; there is no row to lock for a new entry.
  await ex.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`taxonomy:${type}`}))`
  )
}

/** One row, locked until the transaction ends, so a listing that names it in the meantime finishes first. */
export function lockRow<K extends TaxonomyType>(
  ex: Executor,
  find: { type: K; id: string }
) {
  const table = tableOf(find.type)
  return ex
    .select()
    .from(table)
    .where(eq(table.id, find.id))
    .for("update")
    .then(([row]) => row as RowOf[K] | undefined)
}

/** A parent entry exists; it is share-locked so it cannot be deleted before the child is saved. */
export function hasRowShared(
  ex: Executor,
  find: { type: TaxonomyType; id: string }
) {
  const table = tableOf(find.type)
  return ex
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, find.id))
    .for("key share")
    .then((rows) => rows.length > 0)
}

/** The ids that are `base` or `base-<number>`, for the next free slug. */
export function listIdsLike(
  ex: Executor,
  find: { type: TaxonomyType; base: string }
) {
  const table = tableOf(find.type)
  return ex
    .select({ id: table.id })
    .from(table)
    .where(or(eq(table.id, find.base), like(table.id, `${find.base}-%`)))
    .then((rows) => rows.map((row) => row.id))
}

export function hasRow(ex: Executor, find: { type: TaxonomyType; id: string }) {
  const table = tableOf(find.type)
  return ex
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, find.id))
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function insertRow<K extends TaxonomyType>(
  ex: Executor,
  add: { type: K; values: Record<string, unknown> }
) {
  return ex
    .insert(tableOf(add.type))
    .values(add.values)
    .returning()
    .then(([row]) => row as RowOf[K] | undefined)
}

export function updateRow<K extends TaxonomyType>(
  ex: Executor,
  change: { type: K; id: string; set: Record<string, unknown> }
) {
  const table = tableOf(change.type)
  return ex
    .update(table)
    .set(change.set)
    .where(eq(table.id, change.id))
    .returning()
    .then(([row]) => row as RowOf[K] | undefined)
}

export async function deleteRow(
  ex: Executor,
  remove: { type: TaxonomyType; id: string }
) {
  const table = tableOf(remove.type)
  await ex.delete(table).where(eq(table.id, remove.id))
}

/** Another country is on, so this one may be turned off. */
export function hasOtherCountryShown(ex: Executor, id: string) {
  return ex
    .select({ id: countries.id })
    .from(countries)
    .where(and(ne(countries.id, id), eq(countries.enabled, true)))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** Another vehicle type is on, so this one may be hidden. */
export function hasOtherVehicleTypeShown(ex: Executor, id: string) {
  return (
    ex
      .select({ id: vehicleTypes.id })
      .from(vehicleTypes)
      // Compared as text: the id column is an enum and the caller holds a plain string.
      .where(
        and(
          sql`${vehicleTypes.id}::text <> ${id}`,
          eq(vehicleTypes.enabled, true)
        )
      )
      .limit(1)
      .then((rows) => rows.length > 0)
  )
}

/** Cities of the country. */
export function hasCityIn(ex: Executor, countryId: string) {
  return ex
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.countryId, countryId))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** Districts of the city. */
export function hasDistrictIn(ex: Executor, cityId: string) {
  return ex
    .select({ id: districts.id })
    .from(districts)
    .where(eq(districts.cityId, cityId))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** Models of the make. */
export function hasModelOf(ex: Executor, makeId: string) {
  return ex
    .select({ id: models.id })
    .from(models)
    .where(eq(models.makeId, makeId))
    .limit(1)
    .then((rows) => rows.length > 0)
}
