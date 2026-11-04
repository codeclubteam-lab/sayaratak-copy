import { backupSchema } from "@sayaratak/shared/schemas/admin"
import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core"

import { user } from "~/modules/auth/auth.tables"
import { createdAt } from "~/shared/db/columns"

export const backupType = pgEnum("backup_type", backupSchema.shape.type.enum)
export const backupStatus = pgEnum(
  "backup_status",
  backupSchema.shape.status.enum
)

// One pg_dump file; `objectKey` names it in the private R2 bucket. A running backup has no file
// yet, so key and size are set when it is ready.
export const backups = pgTable(
  "backups",
  {
    id: text().primaryKey(),
    type: backupType().notNull(),
    status: backupStatus().notNull(),
    objectKey: text(),
    bytes: bigint({ mode: "number" }),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.createdAt),
    check(
      "backups_ready_has_file",
      sql`${table.status} <> 'ready' or (${table.objectKey} is not null and ${table.bytes} is not null)`
    ),
    check("backups_bytes", sql`${table.bytes} >= 0`),
  ]
)

export type BackupRow = typeof backups.$inferSelect
export type NewBackupRow = typeof backups.$inferInsert
