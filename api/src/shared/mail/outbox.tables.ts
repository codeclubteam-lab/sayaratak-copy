import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { createdAt } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const outboxChannel = pgEnum("outbox_channel", ["email", "push"])

// A push row holds what the phone shows until it is sent; `userId` lets the sender drop it if the phone moved to another account since.
export type PushPayload = {
  userId: string
  title: string
  body: string
  data: Record<string, string>
}
export type OutboxPayload = { code?: string; push?: PushPayload }

// A9: every email (and later push, A18) is a row first, so the HTTP answer
// never waits on SMTP. `payload` holds the code until it is sent or expires,
// then it is emptied: a database dump never holds a live code.
export const outbox = pgTable(
  "outbox",
  {
    id: text().primaryKey(),
    channel: outboxChannel().notNull(),
    to: text().notNull(),
    template: text().notNull(),
    locale: text().notNull(),
    payload: jsonb().$type<OutboxPayload>().notNull(),
    attempts: integer().default(0).notNull(),
    sendAfter: timestamp({ withTimezone: true }).notNull(),
    sentAt: timestamp({ withTimezone: true }),
    lastError: text(),
    createdAt: createdAt(),
  },
  // The retry job reads unsent rows that are due.
  (table) => [
    index().on(table.sendAfter).where(sql`${table.sentAt} is null`),
    // The prune job deletes sent rows a week old.
    index("outbox_sent")
      .on(table.sentAt)
      .where(sql`${table.sentAt} is not null`),
  ]
)

export type OutboxRow = typeof outbox.$inferSelect
export type NewOutboxRow = typeof outbox.$inferInsert
