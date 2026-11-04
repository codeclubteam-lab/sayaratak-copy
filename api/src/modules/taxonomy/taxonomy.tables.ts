import { vehicleTypeSchema } from "@sayaratak/shared/schemas/listing"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core"

import { bilingual, bilingualText, position } from "~/shared/db/columns"

export const vehicleType = pgEnum("vehicle_type", vehicleTypeSchema.enum)

const name = bilingualText

// The id is the lowercase ISO code, given once on create; only enabled countries reach the public site.
export const countries = pgTable(
  "countries",
  {
    id: text().primaryKey(),
    name: name(),
    dialCode: text().notNull(),
    enabled: boolean().notNull(),
    position: position(),
  },
  (table) => [
    check("countries_id_code", sql`${table.id} ~ '^[a-z]{2}$'`),
    check("countries_dial_code", sql`${table.dialCode} ~ '^\\+[0-9]{1,4}$'`),
    check("countries_name", bilingual(table.name)),
  ]
)

// A city's slug is made once from its English name; landing URLs use it, so it never changes.
export const cities = pgTable(
  "cities",
  {
    id: text().primaryKey(),
    countryId: text()
      .notNull()
      .references(() => countries.id),
    slug: text().notNull().unique(),
    name: name(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    position: position(),
  },
  (table) => [
    index().on(table.countryId),
    check("cities_lat", sql`${table.lat} between -90 and 90`),
    check("cities_lng", sql`${table.lng} between -180 and 180`),
    check("cities_name", bilingual(table.name)),
  ]
)

export const districts = pgTable(
  "districts",
  {
    id: text().primaryKey(),
    cityId: text()
      .notNull()
      .references(() => cities.id),
    name: name(),
    position: position(),
  },
  (table) => [
    index().on(table.cityId),
    check("districts_name", bilingual(table.name)),
  ]
)

// The five types are fixed by the enum; admin renames and hides them, never adds or deletes.
export const vehicleTypes = pgTable(
  "vehicle_types",
  {
    id: vehicleType().primaryKey(),
    name: name(),
    enabled: boolean().notNull(),
    position: position(),
  },
  (table) => [check("vehicle_types_name", bilingual(table.name))]
)

export const makes = pgTable(
  "makes",
  {
    id: text().primaryKey(),
    slug: text().notNull().unique(),
    name: name(),
    // An uploaded brand mark; without one the web falls back to its own file, then the initial.
    logoUrl: text(),
    vehicleTypes: vehicleType().array().notNull(),
    position: position(),
  },
  (table) => [
    check("makes_vehicle_types", sql`cardinality(${table.vehicleTypes}) > 0`),
    check("makes_name", bilingual(table.name)),
  ]
)

export const models = pgTable(
  "models",
  {
    id: text().primaryKey(),
    makeId: text()
      .notNull()
      .references(() => makes.id),
    name: name(),
    position: position(),
  },
  (table) => [
    index().on(table.makeId),
    check("models_name", bilingual(table.name)),
  ]
)

export const partCategories = pgTable(
  "part_categories",
  {
    id: text().primaryKey(),
    slug: text().notNull().unique(),
    name: name(),
    position: position(),
  },
  (table) => [check("part_categories_name", bilingual(table.name))]
)

// Mechanic skills; mechanics keep the chosen ids.
export const specializations = pgTable(
  "specializations",
  { id: text().primaryKey(), name: name(), position: position() },
  (table) => [check("specializations_name", bilingual(table.name))]
)

// Name suggestions a workshop picks from when it adds a service.
export const serviceTemplates = pgTable(
  "service_templates",
  { id: text().primaryKey(), name: name(), position: position() },
  (table) => [check("service_templates_name", bilingual(table.name))]
)

export type CountryRow = typeof countries.$inferSelect
export type CityRow = typeof cities.$inferSelect
export type DistrictRow = typeof districts.$inferSelect
export type VehicleTypeRow = typeof vehicleTypes.$inferSelect
export type MakeRow = typeof makes.$inferSelect
export type ModelRow = typeof models.$inferSelect
export type PartCategoryRow = typeof partCategories.$inferSelect
export type SpecializationRow = typeof specializations.$inferSelect
export type ServiceTemplateRow = typeof serviceTemplates.$inferSelect

/** The row of each admin-managed list. */
export type RowOf = {
  cities: CityRow
  districts: DistrictRow
  makes: MakeRow
  models: ModelRow
  "vehicle-types": VehicleTypeRow
  "part-categories": PartCategoryRow
  countries: CountryRow
}
