import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import {
  planSchema,
  subscriptionSchema,
} from "@sayaratak/shared/schemas/billing"
import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { bilingual, bilingualText } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const planAudience = pgEnum(
  "plan_audience",
  planSchema.shape.audience.enum
)
export const subscriptionStatus = pgEnum(
  "subscription_status",
  subscriptionSchema.shape.status.enum
)

const at = () => timestamp({ withTimezone: true })

// A null limit means no cap. The first plan priced 0 of an audience is its free plan.
export const plans = pgTable(
  "plans",
  {
    id: text().primaryKey(),
    audience: planAudience().notNull(),
    name: bilingualText(),
    price: bigint({ mode: "number" }).notNull(),
    durationDays: integer().notNull(),
    listingLimit: integer(),
    serviceLimit: integer(),
    photoLimit: integer(),
    portfolioLimit: integer(),
    features: jsonb().$type<Bilingual[]>().notNull(),
    // Free 7-day Featured pins per period; used ones are counted from `promotions`.
    featuredCredits: integer().default(0).notNull(),
    enabled: boolean().notNull(),
    sortOrder: integer().notNull(),
  },
  (table) => [
    index().on(table.audience, table.sortOrder),
    check("plans_name", bilingual(table.name)),
    check("plans_price", sql`${table.price} >= 0`),
    check("plans_duration", sql`${table.durationDays} > 0`),
    check(
      "plans_limits",
      sql`coalesce(least(${table.listingLimit}, ${table.serviceLimit}, ${table.photoLimit}, ${table.portfolioLimit}), 0) >= 0 and ${table.featuredCredits} >= 0`
    ),
  ]
)

// Price and listing limit are copied from the plan when the subscription starts (an admin can set
// custom ones). `used` is counted from listings on read. The plan foreign key blocks deleting a
// plan in use (409 `in_use`).
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
    planId: text()
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatus().notNull(),
    startsAt: at().notNull(),
    endsAt: at().notNull(),
    price: bigint({ mode: "number" }).notNull(),
    listingLimit: integer(),
    // The admin's note when they assigned the plan.
    note: text(),
    expiringNotifiedAt: at(),
  },
  (table) => [
    uniqueIndex("subscriptions_one_active")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    index().on(table.planId),
    // The expiry job looks for active rows by end date.
    index().on(table.status, table.endsAt),
    check("subscriptions_price", sql`${table.price} >= 0`),
    check("subscriptions_dates", sql`${table.endsAt} > ${table.startsAt}`),
  ]
)

export type PlanRow = typeof plans.$inferSelect
export type NewPlanRow = typeof plans.$inferInsert
export type SubscriptionRow = typeof subscriptions.$inferSelect
export type NewSubscriptionRow = typeof subscriptions.$inferInsert
