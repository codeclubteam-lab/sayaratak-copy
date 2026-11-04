import { reportSchema } from "@sayaratak/shared/schemas/admin"
import { index, pgEnum, pgTable, text } from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { listings } from "~/modules/listings/listings.tables"
import { createdAt } from "~/shared/db/columns"

export const reportReason = pgEnum(
  "report_reason",
  reportSchema.shape.reason.enum
)
export const reportStatus = pgEnum(
  "report_status",
  reportSchema.shape.status.enum
)

// Reports outlive the listing and the reporter (admin history), so both go null on delete.
export const reports = pgTable(
  "reports",
  {
    id: text().primaryKey(),
    listingId: text().references(() => listings.id, { onDelete: "set null" }),
    reporterId: text().references(() => user.id, { onDelete: "set null" }),
    reason: reportReason().notNull(),
    details: text(),
    status: reportStatus().default("open").notNull(),
    resolutionNote: text(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.listingId),
    index().on(table.reporterId),
    index().on(table.status, table.createdAt),
  ]
)
