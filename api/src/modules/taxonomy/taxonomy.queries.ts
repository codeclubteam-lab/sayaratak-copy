import { and, asc, eq, inArray } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  cities,
  countries,
  districts,
  makes,
  models,
  partCategories,
  serviceTemplates,
  specializations,
  vehicleTypes,
} from "./taxonomy.tables"

export function hasCity(ex: Executor, id: string) {
  return ex
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.id, id))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** Every city's center, turned-off countries included (the map's mechanics sit there). */
export function listCityCenters(ex: Executor) {
  return ex
    .select({ id: cities.id, lat: cities.lat, lng: cities.lng })
    .from(cities)
}

/** Cities of enabled countries, in list order. */
export function listShownCities(ex: Executor) {
  return ex
    .select({ city: cities })
    .from(cities)
    .innerJoin(countries, eq(countries.id, cities.countryId))
    .where(eq(countries.enabled, true))
    .orderBy(asc(cities.position))
    .then((rows) => rows.map((row) => row.city))
}

/** Districts whose city belongs to an enabled country, in list order. */
export function listShownDistricts(ex: Executor) {
  return ex
    .select({ district: districts })
    .from(districts)
    .innerJoin(cities, eq(cities.id, districts.cityId))
    .innerJoin(countries, eq(countries.id, cities.countryId))
    .where(eq(countries.enabled, true))
    .orderBy(asc(districts.position))
    .then((rows) => rows.map((row) => row.district))
}

export function listMakes(ex: Executor) {
  return ex.select().from(makes).orderBy(asc(makes.position))
}

export function listModels(ex: Executor) {
  return ex.select().from(models).orderBy(asc(models.position))
}

export function listVehicleTypes(ex: Executor) {
  return ex.select().from(vehicleTypes).orderBy(asc(vehicleTypes.position))
}

export function listPartCategories(ex: Executor) {
  return ex.select().from(partCategories).orderBy(asc(partCategories.position))
}

export function listSpecializations(ex: Executor) {
  return ex
    .select()
    .from(specializations)
    .orderBy(asc(specializations.position))
}

export function listServiceTemplates(ex: Executor) {
  return ex
    .select()
    .from(serviceTemplates)
    .orderBy(asc(serviceTemplates.position))
}

export function hasDistrictIn(
  ex: Executor,
  place: { cityId: string; districtId: string }
) {
  return ex
    .select({ id: districts.id })
    .from(districts)
    .where(
      and(
        eq(districts.id, place.districtId),
        eq(districts.cityId, place.cityId)
      )
    )
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function hasModelOf(
  ex: Executor,
  pick: { makeId: string; modelId: string }
) {
  return ex
    .select({ id: models.id })
    .from(models)
    .where(and(eq(models.id, pick.modelId), eq(models.makeId, pick.makeId)))
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function hasMake(ex: Executor, id: string) {
  return ex
    .select({ id: makes.id })
    .from(makes)
    .where(eq(makes.id, id))
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function hasPartCategory(ex: Executor, id: string) {
  return ex
    .select({ id: partCategories.id })
    .from(partCategories)
    .where(eq(partCategories.id, id))
    .limit(1)
    .then((rows) => rows.length > 0)
}

export function listMakeAndModelNames(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return Promise.all([
    ex
      .select({ id: makes.id, name: makes.name })
      .from(makes)
      .where(inArray(makes.id, ids)),
    ex
      .select({ id: models.id, name: models.name })
      .from(models)
      .where(inArray(models.id, ids)),
  ]).then((lists) => lists.flat())
}

/** Which of these ids are cities. */
export function listCityIdsIn(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select({ id: cities.id })
    .from(cities)
    .where(inArray(cities.id, ids))
    .then((rows) => rows.map((row) => row.id))
}

/** Which of these ids are mechanic specializations. */
export function listSpecializationIdsIn(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select({ id: specializations.id })
    .from(specializations)
    .where(inArray(specializations.id, ids))
    .then((rows) => rows.map((row) => row.id))
}

/** Which of these ids are workshop service templates. */
export function listServiceTemplateIdsIn(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select({ id: serviceTemplates.id })
    .from(serviceTemplates)
    .where(inArray(serviceTemplates.id, ids))
    .then((rows) => rows.map((row) => row.id))
}
