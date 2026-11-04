import { transaction } from "~/shared/db/tx"
import { BATCH_SIZE, drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"

import { retryHostDeletes } from "./uploads.host.service"
import { deleteMediaFiles } from "./uploads.media.service"
import * as q from "./uploads.queries"

const ORPHAN_HOURS = 24
const HOUR_MS = 3_600_000

/**
 * One pass of the `orphan-uploads` job (A10): deletes the uploads nobody attached within a day
 * (a photo picked in the wizard for a post that was never saved, a receipt never sent) from the
 * table and the host, after trying again the host deletes that failed before. Answers how many
 * uploads it deleted and how many files it retried successfully.
 */
export async function cleanUp(size = BATCH_SIZE) {
  const before = new Date(clock.now().getTime() - ORPHAN_HOURS * HOUR_MS)
  // The retries come first, so a delete that fails in this pass waits for the next one.
  const retried = await retryHostDeletes(size)
  const orphans = await drain(
    (limit) =>
      transaction(async (tx) => {
        const ids = await q.lockOrphans(tx, { before, size: limit })
        await deleteMediaFiles(tx, ids)
        return ids.length
      }),
    size
  )
  return retried + orphans
}
