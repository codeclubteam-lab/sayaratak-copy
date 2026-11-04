import { and, desc, eq } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  type BackupRow,
  type NewBackupRow,
  backups,
} from "./admin-backups.tables"

export type { BackupRow }

export function listBackups(ex: Executor) {
  return ex
    .select()
    .from(backups)
    .orderBy(desc(backups.createdAt), desc(backups.id))
}

export function getBackup(ex: Executor, id: string) {
  return ex
    .select()
    .from(backups)
    .where(eq(backups.id, id))
    .then((rows) => rows[0] ?? null)
}

export async function insertBackup(ex: Executor, row: NewBackupRow) {
  await ex.insert(backups).values(row)
}

/** The file is in the bucket: the row gets its key and size. */
export async function markReady(
  ex: Executor,
  id: string,
  file: { objectKey: string; bytes: number }
) {
  await ex
    .update(backups)
    .set({ status: "ready", ...file })
    .where(eq(backups.id, id))
}

export async function markFailed(ex: Executor, id: string) {
  await ex.update(backups).set({ status: "failed" }).where(eq(backups.id, id))
}

/** Puts the rows back as they were, after a restore replaced the table with the dump's own. */
export async function replaceBackups(ex: Executor, rows: BackupRow[]) {
  await ex.delete(backups)
  if (rows.length > 0) await ex.insert(backups).values(rows)
}

/** Ready automatic backups past the newest `keep`: the ones the nightly job deletes. */
export function listAutoBeyond(ex: Executor, keep: number) {
  return ex
    .select({ id: backups.id, objectKey: backups.objectKey })
    .from(backups)
    .where(and(eq(backups.type, "auto"), eq(backups.status, "ready")))
    .orderBy(desc(backups.createdAt), desc(backups.id))
    .offset(keep)
}

export async function deleteBackup(ex: Executor, id: string) {
  await ex.delete(backups).where(eq(backups.id, id))
}
