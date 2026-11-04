import { db } from "~/shared/db/client"
import { afterCommit, type Transaction } from "~/shared/db/tx"
import { files } from "~/shared/files/store"
import { log } from "~/shared/log/logger"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"

import * as q from "./uploads.queries"
import type { UploadRow } from "./uploads.service"

const ID_PREFIX = "fd"
/** A file the host keeps refusing to delete is left in the table after this many tries, for a person to look at. */
const MAX_ATTEMPTS = 20

/**
 * Notes the host file of each deleted upload row as still to delete, in the caller's transaction,
 * and deletes them once it commits (A8). A failed delete keeps its note, so `retryHostDeletes`
 * tries again; nothing is forgotten and nobody waits on the host.
 */
export async function queueHostDeletes(tx: Transaction, deleted: UploadRow[]) {
  const now = clock.now()
  const notes = await q.insertDeletions(
    tx,
    deleted.flatMap((row) =>
      row.cloudinaryId
        ? [
            {
              id: newId(ID_PREFIX),
              publicId: row.cloudinaryId,
              mime: row.mime ?? "",
              delivery: row.delivery,
              createdAt: now,
            },
          ]
        : []
    )
  )
  afterCommit(tx, async () => {
    for (const note of notes) await deleteHostFile(note)
  })
}

/**
 * Tries again the host deletes that failed (A10, `orphan-uploads`). Answers how many files it
 * deleted.
 */
export async function retryHostDeletes(size: number) {
  const notes = await q.listDeletions(db, { maxAttempts: MAX_ATTEMPTS, size })
  let deleted = 0
  for (const note of notes) if (await deleteHostFile(note)) deleted += 1
  return deleted
}

// A file another upload row still uses (a duplicated listing shares its photos) stays on the host.
async function deleteHostFile(note: q.FileDeletionRow) {
  try {
    if (!(await q.hasCloudinaryId(db, note.publicId)))
      await files.remove({
        publicId: note.publicId,
        mime: note.mime,
        delivery: note.delivery,
      })
    await q.deleteDeletion(db, note.id)
    return true
  } catch (error) {
    log.error("file_delete_failed", {
      publicId: note.publicId,
      attempt: note.attempts + 1,
      error,
    })
    await q.updateDeletionFailed(db, note.id)
    return false
  }
}
