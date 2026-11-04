import { deviceInputSchema } from "@sayaratak/shared/schemas/inputs"
import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { createdAt } from "~/shared/db/columns"

export const devicePlatform = pgEnum(
  "device_platform",
  deviceInputSchema.shape.platform.enum
)

// A18: one row per installed app that can get a push. The token is unique, so a
// phone that signs in to another account moves its row instead of keeping two.
export const devices = pgTable(
  "devices",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: devicePlatform().notNull(),
    fcmToken: text().notNull().unique(),
    appVersion: text().notNull(),
    locale: text().notNull(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    // A person's devices, read on every notification.
    index().on(table.userId),
    // The prune job finds phones the app has not opened for 90 days.
    index().on(table.lastSeenAt),
    check("devices_locale", sql`${table.locale} in ('ar', 'en')`),
  ]
)

export type DeviceRow = typeof devices.$inferSelect
export type NewDeviceRow = typeof devices.$inferInsert
