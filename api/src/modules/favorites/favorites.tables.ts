import { index, pgTable, primaryKey, text } from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { listings } from "~/modules/listings/listings.tables"
import { createdAt } from "~/shared/db/columns"

export const favorites = pgTable(
  "favorites",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.listingId] }),
    index().on(table.listingId),
  ]
)
