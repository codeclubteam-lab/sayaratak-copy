import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"
import { profileStatusSchema } from "@sayaratak/shared/schemas/profile"
import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import {
  cities,
  districts,
  serviceTemplates,
  specializations,
} from "~/modules/taxonomy/taxonomy.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { bilingual, bilingualText, createdAt, geo } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const profileStatus = pgEnum("profile_status", profileStatusSchema.enum)

const image = () =>
  text().references((): AnyPgColumn => uploads.id, { onDelete: "set null" })

// Columns every business profile has. One account has one business, so the owner is unique.
// Rating, inventory count and `unavailable` are computed on read, never stored.
const profile = () => ({
  id: text().primaryKey(),
  ownerUserId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  slug: text().notNull().unique(),
  name: bilingualText(),
  cityId: text()
    .notNull()
    .references(() => cities.id),
  whatsapp: text(),
  verified: boolean().default(false).notNull(),
  status: profileStatus().default("active").notNull(),
  suspendedReason: text(),
  createdAt: createdAt(),
})

// Dealerships and workshops have a street address and an optional map pin (indexed for the map bbox); the district can be left empty.
const place = () => ({
  districtId: text().references(() => districts.id),
  address: text().notNull(),
  lat: doublePrecision(),
  lng: doublePrecision(),
  hours: jsonb().$type<WeeklyHours>().notNull(),
  logoUploadId: image(),
  coverUploadId: image(),
  description: bilingualText(),
})

export const dealerships = pgTable(
  "dealerships",
  { ...profile(), ...place(), phones: text().array().notNull() },
  (table) => [
    index().on(table.cityId),
    index().on(table.lat, table.lng),
    check("dealerships_name", bilingual(table.name)),
    check("dealerships_description", bilingual(table.description)),
    check("dealerships_geo", geo(table.lat, table.lng)),
    check("dealerships_phones", sql`cardinality(${table.phones}) > 0`),
  ]
)

export const workshops = pgTable(
  "workshops",
  { ...profile(), ...place(), phone: text().notNull() },
  (table) => [
    index().on(table.cityId),
    index().on(table.lat, table.lng),
    check("workshops_name", bilingual(table.name)),
    check("workshops_description", bilingual(table.description)),
    check("workshops_geo", geo(table.lat, table.lng)),
  ]
)

export const workshopImages = pgTable(
  "workshop_images",
  {
    workshopId: text()
      .notNull()
      .references(() => workshops.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    uploadId: text()
      .notNull()
      .unique()
      .references(() => uploads.id),
  },
  (table) => [primaryKey({ columns: [table.workshopId, table.position] })]
)

// `templateId` is set when the service came from a template; the directory `service` filter matches on it.
export const workshopServices = pgTable(
  "workshop_services",
  {
    id: text().primaryKey(),
    workshopId: text()
      .notNull()
      .references(() => workshops.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().notNull(),
    // Money is bigint (A1 rule 18); the form allows up to 9,999,999,999.
    priceFrom: bigint({ mode: "number" }),
    templateId: text().references(() => serviceTemplates.id, {
      onDelete: "set null",
    }),
    position: integer().notNull(),
  },
  (table) => [
    unique().on(table.workshopId, table.position),
    index().on(table.templateId),
    check("workshop_services_price", sql`${table.priceFrom} >= 0`),
  ]
)

export const mechanics = pgTable(
  "mechanics",
  {
    ...profile(),
    photoUploadId: image(),
    bio: bilingualText(),
    yearsOfExperience: integer().notNull(),
    phone: text().notNull(),
    available: boolean().default(true).notNull(),
  },
  (table) => [
    index().on(table.cityId),
    check("mechanics_name", bilingual(table.name)),
    check("mechanics_bio", bilingual(table.bio)),
    check("mechanics_years", sql`${table.yearsOfExperience} >= 0`),
  ]
)

// Served cities and skills; `position` keeps the order the mechanic picked them in.
export const mechanicCities = pgTable(
  "mechanic_cities",
  {
    mechanicId: text()
      .notNull()
      .references(() => mechanics.id, { onDelete: "cascade" }),
    cityId: text()
      .notNull()
      .references(() => cities.id),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mechanicId, table.cityId] }),
    index().on(table.cityId),
  ]
)

export const mechanicSpecializations = pgTable(
  "mechanic_specializations",
  {
    mechanicId: text()
      .notNull()
      .references(() => mechanics.id, { onDelete: "cascade" }),
    specializationId: text()
      .notNull()
      .references(() => specializations.id),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mechanicId, table.specializationId] }),
    index().on(table.specializationId),
  ]
)

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: text().primaryKey(),
    mechanicId: text()
      .notNull()
      .references(() => mechanics.id, { onDelete: "cascade" }),
    uploadId: text()
      .notNull()
      .unique()
      .references(() => uploads.id),
    caption: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [unique().on(table.mechanicId, table.position)]
)
