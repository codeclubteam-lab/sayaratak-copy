import { db } from "~/shared/db/client"
import type { Actor } from "~/modules/audit/audit.types"

import { takeBackup } from "./admin-backups.dump.service"
import { toBackup } from "./admin-backups.mapper"
import * as q from "./admin-backups.queries"

/** `GET /admin/backups`: every backup, newest first. */
export async function getBackups() {
  return (await q.listBackups(db)).map(toBackup)
}

/** `POST /admin/backups`: takes a backup now and answers it once the file is in the bucket. */
export function startBackup(actor: Actor) {
  return takeBackup({ type: "manual", actor })
}

/** `POST /admin/backups/:id/restore`: never done from the API; the answer says where it is done. */
export function restoreRefusal() {
  return {
    code: "forbidden",
    message:
      "Restore runs from the command line: bun scripts/db-restore.ts <id>",
  }
}
