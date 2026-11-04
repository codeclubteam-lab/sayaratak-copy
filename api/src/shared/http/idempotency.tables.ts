import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { jsonb } from "~/shared/db/jsonb"

// A18. `owner` is `user:<id>` or `upload:<token>` (anonymous uploads), so it
// has no foreign key. `status` stays null while the first request runs.
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    owner: text().notNull(),
    key: text().notNull(),
    method: text().notNull(),
    path: text().notNull(),
    requestHash: text().notNull(),
    status: integer(),
    responseBody: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.owner, table.key] })]
)

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect
export type NewIdempotencyKeyRow = typeof idempotencyKeys.$inferInsert
