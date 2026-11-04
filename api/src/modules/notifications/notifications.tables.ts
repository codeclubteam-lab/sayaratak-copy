import { broadcastStatusSchema } from "@sayaratak/shared/schemas/api"
import { notificationSchema } from "@sayaratak/shared/schemas/messaging"
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

import { role, user } from "~/modules/auth/auth.tables"
import { cities } from "~/modules/taxonomy/taxonomy.tables"
import { bilingual, bilingualText, createdAt } from "~/shared/db/columns"

export const notificationType = pgEnum(
  "notification_type",
  notificationSchema.shape.type.enum
)

export const notifications = pgTable(
  "notifications",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    title: bilingualText(),
    body: bilingualText(),
    href: text(),
    createdAt: createdAt(),
    readAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    // The bell's unread count and the newest-first list.
    index().on(table.userId, table.readAt, table.createdAt),
    // The prune job deletes the read ones that are six months old.
    index("notifications_read_created")
      .on(table.createdAt)
      .where(sql`${table.readAt} is not null`),
    check("notifications_title", bilingual(table.title)),
    check("notifications_body", bilingual(table.body)),
  ]
)

export const broadcastStatus = pgEnum(
  "broadcast_status",
  broadcastStatusSchema.enum
)

// An admin message sent once to every account matching the audience. The job `broadcast-fanout`
// (A10) rings the bells in chunks: `cursor` is the last account id it handled and `recipients` the
// count reached so far, both moved in the same transaction as the bells they cover. The audience
// is frozen at Send: only accounts created before `createdAt` are reached.
export const broadcasts = pgTable(
  "broadcasts",
  {
    id: text().primaryKey(),
    title: bilingualText(),
    body: bilingualText(),
    href: text(),
    roles: role().array().notNull(),
    cityId: text().references(() => cities.id, { onDelete: "set null" }),
    verifiedOnly: boolean().notNull(),
    status: broadcastStatus().default("sent").notNull(),
    cursor: text(),
    recipients: integer().notNull(),
    finishedAt: timestamp({ withTimezone: true }),
    sentBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.createdAt),
    // The job looks for the oldest broadcast still going.
    index("broadcasts_unfinished")
      .on(table.createdAt)
      .where(sql`${table.status} <> 'sent'`),
    check(
      "broadcasts_finished",
      sql`${table.status} <> 'sent' or ${table.finishedAt} is not null`
    ),
    check("broadcasts_title", bilingual(table.title)),
    check("broadcasts_body", bilingual(table.body)),
    check("broadcasts_roles", sql`cardinality(${table.roles}) > 0`),
    check("broadcasts_recipients", sql`${table.recipients} >= 0`),
  ]
)
