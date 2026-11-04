import { transaction } from "~/shared/db/tx"
import { drain } from "~/shared/jobs/batches"
import { both } from "~/shared/text/bilingual"
import { clock } from "~/shared/time/clock"
import { notify } from "~/modules/notifications/notifications.service"

import * as q from "./listings.expiry.queries"

/**
 * Tells each owner once that a listing they had online has expired (A10, the `listing-expired`
 * notice). Nothing else changes: an expired listing already reads as expired by its date. A
 * listing that is not public (draft, pending, rejected, sold) says nothing. The notice and the
 * `expiredNotifiedAt` mark are one transaction, so a crash tells nobody twice and misses nobody.
 * Answers how many listings it handled.
 */
export function notifyExpired(size?: number) {
  return drain(
    (limit) =>
      transaction(async (tx) => {
        const now = clock.now()
        const due = await q.lockExpiredUnnotified(tx, { now, size: limit })
        for (const listing of due) {
          if (!listing.ownerUserId) continue
          await notify(tx, {
            userId: listing.ownerUserId,
            type: "listing_expired",
            title: { ar: "انتهت مدة إعلانك", en: "Your listing expired" },
            body: both(listing.title),
            href: "/listings",
          })
        }
        if (due.length > 0) {
          await q.updateExpiredNotified(tx, {
            ids: due.map((listing) => listing.id),
            at: now,
          })
        }
        return due.length
      }),
    size
  )
}
