import {
  getBackupPlan,
  stampAutoBackup,
} from "~/modules/content/content.service"
import { db } from "~/shared/db/client"
import { backupFiles } from "~/shared/storage/r2"
import { clock } from "~/shared/time/clock"
import { dayOf } from "~/shared/time/khartoum"

import { takeBackup } from "./admin-backups.dump.service"
import * as q from "./admin-backups.queries"

/** How many automatic backups stay; manual ones (button, command line, restore safety copy) are never deleted. */
export const KEEP_AUTO = 14
const FRIDAY = 5

/**
 * The `auto-backup` job (A10): takes the nightly backup when the settings ask for one today
 * (daily, or weekly and today is Friday in Khartoum) and none was taken today, stamps
 * `lastAutoBackupAt`, then deletes automatic backups beyond the newest 14. The prune runs on every
 * pass, so a pass that crashed after the dump still finishes it next time. Answers how many
 * backups it took and deleted.
 */
export async function autoBackup() {
  const plan = await getBackupPlan(db)
  const now = clock.now()
  const today = dayOf(now)
  const due =
    plan.schedule === "daily" ||
    (plan.schedule === "weekly" && new Date(today).getUTCDay() === FRIDAY)
  const done = plan.lastAutoBackupAt && dayOf(plan.lastAutoBackupAt) === today
  let handled = 0
  if (due && !done) {
    await takeBackup({ type: "auto" })
    await stampAutoBackup(db, clock.now())
    handled += 1
  }
  return handled + (await pruneAutoBackups())
}

/** Deletes each old file, then its row; a file already gone is fine, so a crash between the two is finished by the next pass. */
export async function pruneAutoBackups(keep = KEEP_AUTO) {
  const old = await q.listAutoBeyond(db, keep)
  for (const { id, objectKey } of old) {
    if (objectKey) await backupFiles.remove(objectKey)
    await q.deleteBackup(db, id)
  }
  return old.length
}
