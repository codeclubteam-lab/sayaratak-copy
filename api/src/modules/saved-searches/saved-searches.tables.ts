import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { createdAt } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    params: jsonb().$type<SearchParams>().notNull(),
    alerts: boolean().notNull(),
    // Matches since the owner last opened the search.
    newCount: integer().default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.userId),
    check("saved_searches_new_count", sql`${table.newCount} >= 0`),
  ]
)
