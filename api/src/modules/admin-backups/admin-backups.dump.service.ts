import { env } from "~/env"
import { db } from "~/shared/db/client"
import { pgTool } from "~/shared/db/pg-tool"
import { transaction } from "~/shared/db/tx"
import { backupFiles } from "~/shared/storage/r2"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"

import { toBackup } from "./admin-backups.mapper"
import * as q from "./admin-backups.queries"

type Who = {
  type: "manual" | "auto"
  /** The admin who asked; none for the command line and the schedule. */
  actor?: Actor
}

/**
 * Takes a backup: a `running` row, then `pg_dump` streamed into the private bucket, then the row
 * is `ready` with the file's size. A dump that fails leaves a `failed` row and no object, and
 * throws. The answer waits for the dump (ponytail: seconds at this size; hand it to a job if the
 * database grows to gigabytes).
 */
export async function takeBackup({ type, actor }: Who) {
  const id = newId("bk")
  const key = `backups/${id}.dump`
  await transaction(async (tx) => {
    await q.insertBackup(tx, {
      id,
      type,
      status: "running",
      createdBy: actor?.admin.id ?? null,
      createdAt: clock.now(),
    })
    if (actor)
      await recordAudit(tx, actor, {
        action: "backup.create",
        targetType: "backup",
        targetId: id,
      })
  })
  try {
    const bytes = await dumpTo(key)
    await q.markReady(db, id, { objectKey: key, bytes })
  } catch (error) {
    await backupFiles.remove(key).catch(() => undefined)
    await q.markFailed(db, id)
    throw error
  }
  const row = await q.getBackup(db, id)
  if (!row) throw new Error("backup vanished after the dump")
  return toBackup(row)
}

// Custom format so `pg_restore` can clean and run in one transaction; no owner or grants, since
// the database it goes back into may have other roles.
async function dumpTo(key: string) {
  const dump = Bun.spawn(
    pgTool("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      env.DATABASE_URL,
    ]),
    { stdout: "pipe", stderr: "pipe" }
  )
  const [bytes, code, errors] = await Promise.all([
    backupFiles.put(key, dump.stdout),
    dump.exited,
    new Response(dump.stderr).text(),
  ])
  if (code !== 0) throw new Error(`pg_dump exited with ${code}: ${errors}`)
  return bytes
}
