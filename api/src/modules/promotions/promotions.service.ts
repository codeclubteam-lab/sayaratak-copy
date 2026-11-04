import type { Listing } from "@sayaratak/shared/schemas/listing"

import { db } from "~/shared/db/client"
import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"
import { bumpListing } from "~/modules/listings/listings.service"

import * as admin from "./promotions.admin.queries"
import * as expiry from "./promotions.expiry.queries"
import * as q from "./promotions.queries"

/**
 * Ends the running promotions of these listings now. Unpaid ones keep
 * `pending_payment`: they never ran, the `promotions_dates` check needs dates
 * for an ended one, and their receipt is rejected with the account.
 */
export async function endPromotionsOf(tx: Transaction, listingIds: string[]) {
  if (listingIds.length === 0) return
  await q.updateEndedFor(tx, { listingIds, at: clock.now() })
}

/**
 * Marks running promotions past their end as `ended` (A10). Reads already treat them as over, so
 * this only makes the stored state catch up. Answers how many it ended.
 */
export function endExpired(size?: number) {
  return drain(
    (limit) => expiry.updateEndedBatch(db, { now: clock.now(), size: limit }),
    size
  )
}

/**
 * The promotions running on each listing now, oldest first, as a listing
 * shows them. One whose end has passed is over even before the job marks it
 * (A10). A bump is done at once and never runs.
 */
export async function getRunningOf(ex: Executor, listingIds: string[]) {
  const running = new Map<string, Listing["promotions"]>()
  if (listingIds.length === 0) return running
  const rows = await q.listRunning(ex, { listingIds, now: clock.now() })
  for (const row of rows) {
    if (!row.startsAt || !row.endsAt) continue
    const list = running.get(row.listingId) ?? []
    list.push({
      type: row.type,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    })
    running.set(row.listingId, list)
  }
  return running
}

/** Listings Featured right now (started, not yet ended): they rank first and fill the home rail. */
export function listFeaturedIds(ex: Executor) {
  return q.listFeaturedIds(ex, clock.now())
}

/** Credit promotions of these listings started since the subscription period began. */
export function countCreditsUsed(
  ex: Executor,
  scope: { listingIds: string[]; since: Date }
) {
  return q.countCreditsSince(ex, scope)
}

/**
 * An order the payer may pay for: the promotion and the price of its type and
 * length (0 when the price row is gone, as the mock). Undefined without such a promotion.
 */
export async function getPromotionToPay(ex: Executor, id: string) {
  const row = await q.getPromotion(ex, id)
  if (!row) return undefined
  return { ...row, price: (await q.getPrice(ex, row)) ?? 0 }
}

const DAY_MS = 86_400_000

/**
 * The admin accepted the receipt for an unpaid promotion: it starts now for
 * its days. A bump is done at once (it ends as it starts) and moves the
 * listing back to the top of the newest. A promotion that already runs or
 * ended is left alone. 404 for an unknown promotion.
 */
export async function startPaidPromotion(
  tx: Transaction,
  paid: { id: string; paymentId: string }
) {
  const row = await admin.lockPromotion(tx, paid.id)
  if (!row) fail.notFound()
  if (row.status !== "pending_payment") return
  const now = clock.now()
  const run = runOf({ type: row.type, days: row.durationDays, now })
  await admin.updateStarted(tx, {
    id: row.id,
    set: { paymentId: paid.paymentId, ...run },
  })
  if (row.type === "bump") await bumpListing(tx, { id: row.listingId, at: now })
}

/**
 * When a promotion that starts at `now` runs: a Featured for its days, a bump
 * not at all (it ends as it starts and only moves the listing up).
 */
export function runOf(start: {
  type: "featured" | "bump"
  days: number
  now: Date
}) {
  const bump = start.type === "bump"
  return {
    status: bump ? ("ended" as const) : ("active" as const),
    startsAt: start.now,
    endsAt: bump
      ? start.now
      : new Date(start.now.getTime() + start.days * DAY_MS),
  }
}

/** What approval of a promotion payment starts, keyed by promotion id: type, length and listing. */
export async function getPromotions(ex: Executor, ids: string[]) {
  const rows = await admin.listByIds(ex, ids)
  return new Map(rows.map((row) => [row.id, row]))
}
