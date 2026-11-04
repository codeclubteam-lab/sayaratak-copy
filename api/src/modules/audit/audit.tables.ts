import { index, pgTable, text } from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { createdAt } from "~/shared/db/columns"
import { jsonb } from "~/shared/db/jsonb"

// One row per admin mutation, written in the same transaction (A1 rule 6); feeds the admin activity.
// Append only: the app role (10.5) gets INSERT and SELECT on it, no UPDATE or DELETE. The admin
// goes null when that account is deleted, so the history stays.
export const auditLog = pgTable(
  "audit_log",
  {
    id: text().primaryKey(),
    adminId: text().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text().notNull(),
    before: jsonb().$type<unknown>(),
    after: jsonb().$type<unknown>(),
    reason: text(),
    ip: text(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.createdAt),
    index().on(table.targetType, table.targetId),
  ]
)

export type NewAuditRow = typeof auditLog.$inferInsert
