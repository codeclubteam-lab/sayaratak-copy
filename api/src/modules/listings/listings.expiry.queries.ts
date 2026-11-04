import { and, eq, inArray, isNull, lt, or } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { LIVE_STATUS } from "./listings.queries"
import { listings } from "./listings.tables"

/**
 * Up to `size` listings that were shown and have expired since the owner was last told, locked
 * until the transaction ends. `expiredNotifiedAt` older than `expiresAt` means the notice was for
 * an earlier end: a renewed listing that expires again is told again.
 */
export function lockExpiredUnnotified(
  ex: Executor,
  batch: { now: Date; size: number }
) {
  return ex
    .select({
      id: listings.id,
      title: listings.title,
      ownerUserId: listings.ownerUserId,
    })
    .from(listings)
    .where(
      and(
        eq(listings.moderation, "approved"),
        inArray(listings.status, LIVE_STATUS),
        lt(listings.expiresAt, batch.now),
        or(
          isNull(listings.expiredNotifiedAt),
          lt(listings.expiredNotifiedAt, listings.expiresAt)
        )
      )
    )
    .limit(batch.size)
    .for("update", { skipLocked: true })
}

export function updateExpiredNotified(
  ex: Executor,
  change: { ids: string[]; at: Date }
) {
  return ex
    .update(listings)
    .set({ expiredNotifiedAt: change.at })
    .where(inArray(listings.id, change.ids))
}
