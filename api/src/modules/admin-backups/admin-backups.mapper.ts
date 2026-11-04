import type { Backup } from "@sayaratak/shared/schemas/admin"

import type { BackupRow } from "./admin-backups.tables"

const BYTES_PER_MB = 1024 * 1024

/** The wire shape: size in megabytes to two decimals, 0 until the file is in the bucket. */
export function toBackup(row: BackupRow): Backup {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    sizeMb: Math.round(((row.bytes ?? 0) / BYTES_PER_MB) * 100) / 100,
    type: row.type,
    status: row.status,
  }
}
