import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"

import { env } from "~/env"
import { ensureAppRole } from "~/shared/db/app-role"
import { connect, db } from "~/shared/db/client"
import { pgTool } from "~/shared/db/pg-tool"
import { apiIsRunning } from "~/shared/db/running-lock"
import { backupFiles } from "~/shared/storage/r2"
import { recordSystemAudit } from "~/modules/audit/audit.service"

import { takeBackup } from "./admin-backups.dump.service"
import * as q from "./admin-backups.queries"

/**
 * Puts the database back as a backup had it. Only the restore command calls this: the API itself
 * answers 403 (A2). Order: check the backup and that no API process is up, download the file
 * (a demo backup has no file, so it stops here with nothing touched), take a fresh backup of
 * the present state, then `pg_restore` in one transaction. The `backups` table is put back as it
 * was just before, so the history keeps every row, the fresh backup included.
 */
export async function restoreBackup(id: string, { force }: { force: boolean }) {
  const backup = await q.getBackup(db, id)
  if (backup?.status !== "ready" || !backup.objectKey)
    throw new Error(`${id} is not a ready backup`)
  if (!force && (await apiIsRunning()))
    throw new Error("an API process is running; stop it first, or pass --force")
  const file = `${tmpdir()}/${id}.dump`
  try {
    await backupFiles.download(backup.objectKey, file)
    const before = await takeBackup({ type: "manual" })
    const history = await q.listBackups(db)
    await runRestore(file)
    // The restore made the tables again without grants (`--no-privileges`).
    if (env.MIGRATE_DATABASE_URL)
      await ensureAppRole(env.MIGRATE_DATABASE_URL, env.DATABASE_URL)
    await afterRestore(id, before.id, history)
    return { safetyBackupId: before.id }
  } finally {
    await rm(file, { force: true })
  }
}

async function runRestore(file: string) {
  const restore = Bun.spawn(
    pgTool("pg_restore", [
      "--clean",
      "--if-exists",
      "--single-transaction",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      env.MIGRATE_DATABASE_URL ?? env.DATABASE_URL,
    ]),
    { stdin: Bun.file(file), stdout: "ignore", stderr: "pipe" }
  )
  const [code, errors] = await Promise.all([
    restore.exited,
    new Response(restore.stderr).text(),
  ])
  if (code !== 0) throw new Error(`pg_restore exited with ${code}: ${errors}`)
}

// A new pool, not `db`: the restore made the types again, so `db`'s prepared statements are dead.
// It runs its own transaction because `transaction()` is bound to `db`.
async function afterRestore(
  id: string,
  safetyId: string,
  history: q.BackupRow[]
) {
  const fresh = connect(1)
  try {
    await fresh.transaction(async (tx) => {
      await q.replaceBackups(tx, history)
      await recordSystemAudit(tx, {
        action: "backup.restore",
        targetType: "backup",
        targetId: id,
        reason: `restore command; the state before is backup ${safetyId}`,
      })
    })
  } finally {
    await fresh.$client.close()
  }
}
