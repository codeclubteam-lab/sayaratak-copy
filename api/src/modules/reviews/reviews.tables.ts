import {
  reviewSchema,
  targetTypeSchema,
} from "@sayaratak/shared/schemas/review"
import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { createdAt } from "~/shared/db/columns"

// The three kinds of business profile; reviews and verification requests point at one.
export const targetType = pgEnum("target_type", targetTypeSchema.enum)
export const reviewStatus = pgEnum(
  "review_status",
  reviewSchema.shape.status.enum
)

// `targetId` names a dealership, workshop or mechanic by `targetType`, so it carries no foreign key;
// the service deletes a business's reviews with it (A5). A deleted author's reviews stay, by name.
export const reviews = pgTable(
  "reviews",
  {
    id: text().primaryKey(),
    targetType: targetType().notNull(),
    targetId: text().notNull(),
    authorId: text().references(() => user.id, { onDelete: "set null" }),
    authorName: text().notNull(),
    rating: integer().notNull(),
    body: text(),
    replyBody: text(),
    replyAt: timestamp({ withTimezone: true }),
    status: reviewStatus().default("visible").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique().on(table.authorId, table.targetType, table.targetId),
    index().on(table.targetType, table.targetId),
    index().on(table.status),
    check("reviews_rating", sql`${table.rating} between 1 and 5`),
    check(
      "reviews_reply",
      sql`(${table.replyBody} is null) = (${table.replyAt} is null)`
    ),
  ]
)
