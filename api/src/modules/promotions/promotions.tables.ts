import { promotionSchema } from "@sayaratak/shared/schemas/billing"
import { promotionTypeSchema } from "@sayaratak/shared/schemas/listing"
import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { listings } from "~/modules/listings/listings.tables"
import { payments } from "~/modules/payments/payments.tables"

export const promotionType = pgEnum("promotion_type", promotionTypeSchema.enum)
export const promotionStatus = pgEnum(
  "promotion_status",
  promotionSchema.shape.status.enum
)
export const promotionSource = pgEnum(
  "promotion_source",
  promotionSchema.shape.source.enum
)

const at = () => timestamp({ withTimezone: true })

// Featured has one row per length (3, 7 and 14 days); a bump one row with 0 days.
export const promotionPrices = pgTable(
  "promotion_prices",
  {
    id: text().primaryKey(),
    type: promotionType().notNull(),
    durationDays: integer().notNull(),
    price: bigint({ mode: "number" }).notNull(),
  },
  (table) => [
    unique().on(table.type, table.durationDays),
    check("promotion_prices_price", sql`${table.price} >= 0`),
  ]
)

// Dates are set when the promotion starts running.
export const promotions = pgTable(
  "promotions",
  {
    id: text().primaryKey(),
    listingId: text()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    type: promotionType().notNull(),
    status: promotionStatus().notNull(),
    durationDays: integer().notNull(),
    startsAt: at(),
    endsAt: at(),
    source: promotionSource().notNull(),
    paymentId: text().references(() => payments.id, { onDelete: "set null" }),
  },
  (table) => [
    // One unpaid order per listing, type and length, so a second checkout reuses it.
    uniqueIndex("promotions_one_unpaid")
      .on(table.listingId, table.type, table.durationDays)
      .where(sql`${table.status} = 'pending_payment'`),
    index().on(table.listingId),
    // Running promotions by end date: search ranking and the ending job.
    index().on(table.status, table.endsAt),
    check(
      "promotions_dates",
      sql`${table.status} = 'pending_payment' or (${table.startsAt} is not null and ${table.endsAt} is not null)`
    ),
  ]
)

export type PromotionRow = typeof promotions.$inferSelect
export type NewPromotionRow = typeof promotions.$inferInsert
