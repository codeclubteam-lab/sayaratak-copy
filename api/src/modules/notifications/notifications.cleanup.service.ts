import { db } from "~/shared/db/client"
import { BATCH_SIZE, drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"

import * as q from "./notifications.cleanup.queries"

// Owner, 9.3 (O3): read notifications are kept six months. Unread ones are never deleted.
const READ_KEPT_DAYS = 183
const DAY_MS = 86_400_000

/** Deletes the notifications that were read and are older than six months (A10, `prune`). Answers how many. */
export function pruneRead(size = BATCH_SIZE) {
  const before = new Date(clock.now().getTime() - READ_KEPT_DAYS * DAY_MS)
  return drain((limit) => q.deleteReadBatch(db, { before, size: limit }), size)
}
