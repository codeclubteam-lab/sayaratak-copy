import { verificationRequestSchema } from "@sayaratak/shared/schemas/admin"
import { sql } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { targetType } from "~/modules/reviews/reviews.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { createdAt } from "~/shared/db/columns"

export const verificationStatus = pgEnum(
  "verification_status",
  verificationRequestSchema.shape.status.enum
)

// `targetId` names a business by `targetType`: no foreign key; the request goes with its owner.
export const verificationRequests = pgTable(
  "verification_requests",
  {
    id: text().primaryKey(),
    targetType: targetType().notNull(),
    targetId: text().notNull(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text(),
    status: verificationStatus().default("pending").notNull(),
    rejectionReason: text(),
    createdAt: createdAt(),
  },
  (table) => [
    // One open request per business.
    uniqueIndex("verification_requests_one_pending")
      .on(table.targetType, table.targetId)
      .where(sql`${table.status} = 'pending'`),
    index().on(table.ownerId),
    index().on(table.status, table.createdAt),
  ]
)

// Documents are private uploads; only the owner and admins reach them (A8).
export const verificationDocuments = pgTable(
  "verification_documents",
  {
    id: text().primaryKey(),
    requestId: text()
      .notNull()
      .references(() => verificationRequests.id, { onDelete: "cascade" }),
    label: text().notNull(),
    uploadId: text()
      .notNull()
      .unique()
      .references(() => uploads.id),
    position: integer().notNull(),
  },
  (table) => [unique().on(table.requestId, table.position)]
)
