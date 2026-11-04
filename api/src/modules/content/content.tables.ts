import { type Settings, sitePageSchema } from "@sayaratak/shared/schemas/admin"
import { contactSubjects } from "@sayaratak/shared/schemas/inputs"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { bilingual, bilingualText, createdAt } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const backupSchedule = pgEnum("backup_schedule", [
  "daily",
  "weekly",
  "off",
])

// The site settings live in one row with id 1; the id check keeps it one.
export const settings = pgTable(
  "settings",
  {
    id: integer().primaryKey().default(1),
    autoApproveVerifiedDealers: boolean().notNull(),
    listingExpiryDays: integer().notNull(),
    individualSubscriptionsEnabled: boolean().notNull(),
    freeListingLimit: integer().notNull(),
    bankakName: text().notNull(),
    bankakNumber: text().notNull(),
    contact: jsonb().$type<Settings["contact"]>().notNull(),
    locales: text().array().$type<Settings["locales"]>().notNull(),
    backupSchedule: backupSchedule().notNull(),
    lastAutoBackupAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check("settings_single_row", sql`${table.id} = 1`),
    check("settings_locales_known", sql`${table.locales} <@ array['ar', 'en']`),
    check("settings_expiry_positive", sql`${table.listingExpiryDays} > 0`),
    check(
      "settings_free_limit_not_negative",
      sql`${table.freeListingLimit} >= 0`
    ),
  ]
)

export type SettingsRow = typeof settings.$inferSelect
export type NewSettingsRow = typeof settings.$inferInsert

export const sitePageSlug = pgEnum(
  "site_page_slug",
  sitePageSchema.shape.slug.enum
)

// The four fixed pages (about, contact, privacy, terms); admins edit them, never add one.
export const sitePages = pgTable(
  "site_pages",
  {
    slug: sitePageSlug().primaryKey(),
    title: bilingualText(),
    body: bilingualText(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    check("site_pages_title_bilingual", bilingual(table.title)),
    check("site_pages_body_bilingual", bilingual(table.body)),
  ]
)

export const contactSubject = pgEnum("contact_subject", contactSubjects)

// Messages from the public contact form; `contact` is the phone or email the sender typed.
export const contacts = pgTable(
  "contacts",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    contact: text().notNull(),
    subject: contactSubject().notNull(),
    message: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index().on(table.createdAt)]
)

export type SitePageRow = typeof sitePages.$inferSelect
export type NewContactRow = typeof contacts.$inferInsert
