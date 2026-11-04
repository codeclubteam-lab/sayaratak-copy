import { db } from "~/shared/db/client"
import { BATCH_SIZE, drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"

import { deleteOldKeys } from "./idempotency.queries"

const DAY_MS = 86_400_000

/** Deletes the idempotency keys older than 24 hours (A10, `prune`). Answers how many. */
export function pruneKeys(size = BATCH_SIZE) {
  const before = new Date(clock.now().getTime() - DAY_MS)
  return drain((limit) => deleteOldKeys(db, { before, size: limit }), size)
}
