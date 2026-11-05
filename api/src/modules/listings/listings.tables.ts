import {
  fuelSchema,
  intentSchema,
  type Listing,
  listingStatusSchema,
  moderationSchema,
  transmissionSchema,
} from "@sayaratak/shared/schemas/listing"
import type { ExtraFields } from "@sayaratak/shared/schemas/listing-fields"
import { sql } from "drizzle-orm"
import {
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
  timestamp,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import {
  cities,
  districts,
  makes,
  models,
  partCategories,
  vehicleType,
} from "~/modules/taxonomy/taxonomy.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { bilingual, bilingualText, createdAt, geo } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const listingKind = pgEnum("listing_kind", ["vehicle", "part"])
export const intent = pgEnum("intent", intentSchema.enum)
export const fuel = pgEnum("fuel", fuelSchema.enum)
export const transmission = pgEnum("transmission", transmissionSchema.enum)
export const rentPeriod = pgEnum("rent_period", ["day", "week", "month"])
export const condition = pgEnum("condition", ["new", "used"])
export const listingStatus = pgEnum("listing_status", listingStatusSchema.enum)
export const moderation = pgEnum("moderation", moderationSchema.enum)
export const ownerType = pgEnum("owner_type", ["user", "dealership"])

const at = () => timestamp({ withTimezone: true })

// Filters and sorts are real columns; the long tail of spec fields (`listing-fields.ts`) sits in
// `details`. Active promotions come from `promotions`, counters from `listing_stats`.
export const listings = pgTable(
  "listings",
  {
    id: text().primaryKey(),
    slug: text().notNull().unique(),
    // Null once the owner's account is deleted; the listing stays, marked removed (A2).
    ownerUserId: text().references(() => user.id, { onDelete: "set null" }),
    // A dealership posts as its business. The name is kept so a removed listing still shows who posted it.
    ownerType: ownerType().notNull(),
    ownerName: bilingualText(),
    kind: listingKind().notNull(),
    intent: intent().notNull(),
    vehicleType: vehicleType(),
    title: text().notNull(),
    description: bilingualText(),
    price: bigint({ mode: "number" }).notNull(),
    negotiable: boolean().notNull(),
    rentPeriod: rentPeriod(),
    condition: condition().notNull(),
    makeId: text().references(() => makes.id),
    modelId: text().references(() => models.id),
    makeOther: text(),
    modelOther: text(),
    year: integer(),
    mileageKm: integer(),
    fuel: fuel(),
    transmission: transmission(),
    color: text(),
    engineCc: integer(),
    payloadTons: doublePrecision(),
    partNumber: text(),
    partCategoryId: text().references(() => partCategories.id),
    compatibleTypes: vehicleType().array().default([]).notNull(),
    details: jsonb().$type<ExtraFields>().notNull(),
    cityId: text()
      .notNull()
      .references(() => cities.id),
    districtId: text().references(() => districts.id),
    lat: doublePrecision(),
    lng: doublePrecision(),
    contact: jsonb().$type<Listing["contact"]>().notNull(),
    status: listingStatus().notNull(),
    moderation: moderation().notNull(),
    rejectionReason: text(),
    // Title, both description slots and make and model names in both languages, lowercased.
    // Written by the service on every save: the names live in other tables.
    searchText: text().notNull(),
    // When a bump last put the listing back at the top of the newest.
    bumpedAt: at(),
    expiresAt: at().notNull(),
    expiredNotifiedAt: at(),
    createdAt: createdAt(),
    updatedAt: at().notNull(),
  },
  (table) => [
    index().on(table.ownerUserId),
    index().on(table.cityId),
    index().on(table.districtId),
    index().on(table.makeId),
    index().on(table.modelId),
    index().on(table.partCategoryId),
    // Public search always narrows to approved rows of one kind and intent first.
    index("listings_public")
      .on(table.kind, table.intent, table.vehicleType)
      .where(sql`${table.moderation} = 'approved'`),
    index().on(table.price),
    index().on(table.year),
    index().on(table.mileageKm),
    index("listings_posted").on(
      sql`coalesce(${table.bumpedAt}, ${table.createdAt}) desc`
    ),
    index().on(table.expiresAt),
    // The admin table: every listing newest first (10.6: a seq scan and sort took 176 ms).
    // Raw `desc`: the builder's `.desc()` writes NULLS LAST, which `order by ... desc` cannot use.
    index("listings_created").on(sql`${table.createdAt} desc`, table.id),
    // Radius search and the map: a bounding box on the pin (A11).
    index().on(table.lat, table.lng),
    index().using("gin", table.compatibleTypes),
    index("listings_details").using(
      "gin",
      sql`${table.details} jsonb_path_ops`
    ),
    index().using("gin", table.searchText.op("gin_trgm_ops")),
    check("listings_id", sql`${table.id} ~ '^l[0-9a-z]{5}$'`),
    check("listings_owner_name", bilingual(table.ownerName)),
    check("listings_description", bilingual(table.description)),
    check("listings_price", sql`${table.price} >= 0`),
    check("listings_mileage", sql`${table.mileageKm} >= 0`),
    check("listings_geo", geo(table.lat, table.lng)),
  ]
)

// Counters live off the listing row: a view would otherwise rewrite the whole row and lock hot listings.
export const listingStats = pgTable("listing_stats", {
  listingId: text()
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  views: integer().default(0).notNull(),
  favorites: integer().default(0).notNull(),
  phoneClicks: integer().default(0).notNull(),
  whatsappClicks: integer().default(0).notNull(),
})

export const listingMedia = pgTable(
  "listing_media",
  {
    listingId: text()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    uploadId: text()
      .notNull()
      .unique()
      .references(() => uploads.id),
  },
  (table) => [primaryKey({ columns: [table.listingId, table.position] })]
)

export type ListingRow = typeof listings.$inferSelect
export type NewListingRow = typeof listings.$inferInsert
