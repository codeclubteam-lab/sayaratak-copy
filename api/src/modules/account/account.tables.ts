import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { jsonb } from "~/shared/db/jsonb"

// A form saved half way (the post wizard, onboarding), one per user and key.
export const drafts = pgTable(
  "drafts",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)
