import { type Banner, bannerSchema } from "@sayaratak/shared/schemas/admin"
import {
  adPageIdSchema,
  type Creative,
  campaignStatusSchema,
} from "@sayaratak/shared/schemas/ads"
import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { createdAt, position } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const adPage = pgEnum("ad_page", adPageIdSchema.enum)
export const campaignStatus = pgEnum(
  "campaign_status",
  campaignStatusSchema.enum
)
export const bannerPlacement = pgEnum(
  "banner_placement",
  bannerSchema.shape.placement.enum
)

const at = () => timestamp({ withTimezone: true })
const image = () => text().references(() => uploads.id)

// Pages that sell banner space: admin-set weekly price and slot count. `free` is computed per request.
export const adPages = pgTable(
  "ad_pages",
  {
    id: adPage().primaryKey(),
    weeklyPrice: bigint({ mode: "number" }).notNull(),
    slots: integer().notNull(),
    enabled: boolean().notNull(),
    position: position(),
  },
  (table) => [
    check("ad_pages_price", sql`${table.weeklyPrice} >= 0`),
    check("ad_pages_slots", sql`${table.slots} >= 1`),
  ]
)

// A self-serve banner. The slot check locks the `ad_pages` rows it books (A1 rule 16).
// Campaigns stay when the advertiser's account goes (payment history).
export const campaigns = pgTable(
  "campaigns",
  {
    id: text().primaryKey(),
    ownerId: text().references(() => user.id, { onDelete: "set null" }),
    imageUploadId: image().notNull(),
    copy: jsonb().$type<Creative["copy"]>().notNull(),
    href: text().notNull(),
    pages: adPage().array().notNull(),
    startsAt: at().notNull(),
    weeks: integer().notNull(),
    endsAt: at().notNull(),
    amount: bigint({ mode: "number" }).notNull(),
    status: campaignStatus().default("pending_payment").notNull(),
    rejectionReason: text(),
    impressions: integer().default(0).notNull(),
    clicks: integer().default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.ownerId),
    index().on(table.status, table.startsAt, table.endsAt),
    index().using("gin", table.pages),
    check("campaigns_pages", sql`cardinality(${table.pages}) > 0`),
    check("campaigns_weeks", sql`${table.weeks} between 1 and 4`),
    check("campaigns_dates", sql`${table.endsAt} > ${table.startsAt}`),
    check("campaigns_amount", sql`${table.amount} >= 0`),
  ]
)

// An admin banner: one image per language, real text on top (`copy`, none on a finished image).
export const banners = pgTable(
  "banners",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    imageArUploadId: image().notNull(),
    imageEnUploadId: image().notNull(),
    copy: jsonb().$type<NonNullable<Banner["copy"]>>(),
    sponsored: boolean().default(false).notNull(),
    // Vertical focal point of the photo, in percent.
    focus: integer().default(50).notNull(),
    href: text().notNull(),
    placement: bannerPlacement().notNull(),
    startsAt: at().notNull(),
    endsAt: at().notNull(),
    active: boolean().notNull(),
    sortOrder: integer().notNull(),
    impressions: integer().default(0).notNull(),
    clicks: integer().default(0).notNull(),
  },
  (table) => [
    index().on(table.placement, table.sortOrder),
    check("banners_focus", sql`${table.focus} between 0 and 100`),
    check("banners_dates", sql`${table.endsAt} > ${table.startsAt}`),
  ]
)

export type AdPageRow = typeof adPages.$inferSelect
export type BannerRow = typeof banners.$inferSelect
export type NewBannerRow = typeof banners.$inferInsert
export type CampaignRow = typeof campaigns.$inferSelect
export type NewCampaignRow = typeof campaigns.$inferInsert
