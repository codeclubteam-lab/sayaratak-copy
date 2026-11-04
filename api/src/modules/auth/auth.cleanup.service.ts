import { db } from "~/shared/db/client"
import { BATCH_SIZE, drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"

import * as accounts from "./auth.accounts.queries"
import * as cleanup from "./auth.cleanup.queries"

const UNFINISHED_HOURS = 24
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/**
 * Deletes the sign-ups that never entered their emailed code within a day (A10, A6), so the
 * address is free again. Such an account cannot sign in, so it owns nothing. Answers how many
 * it deleted.
 */
export function deleteUnfinishedSignUps(size?: number) {
  const before = new Date(clock.now().getTime() - UNFINISHED_HOURS * HOUR_MS)
  return drain(
    (limit) => accounts.deleteUnfinishedSignUps(db, { before, size: limit }),
    size
  )
}

/**
 * Drops what has run out (A10, `prune`): sessions and emailed codes past their time, request
 * counters and failed sign-ins older than a day. Answers how many rows it deleted.
 */
export async function pruneExpired(size = BATCH_SIZE) {
  const now = clock.now()
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const batches = [
    (limit: number) =>
      cleanup.deleteExpiredSessions(db, { before: now, size: limit }),
    (limit: number) =>
      cleanup.deleteExpiredVerifications(db, { before: now, size: limit }),
    (limit: number) =>
      cleanup.deleteOldRateLimits(db, { before: dayAgo, size: limit }),
    (limit: number) =>
      cleanup.deleteOldLoginFailures(db, { before: dayAgo, size: limit }),
  ]
  let total = 0
  for (const batch of batches) total += await drain(batch, size)
  return total
}
