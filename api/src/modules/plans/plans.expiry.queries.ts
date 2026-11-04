import { and, asc, eq, gt, inArray, isNull, lt, lte } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { plans, subscriptions } from "./plans.tables"

/** Active subscriptions whose end has passed, oldest end first, with what their plan says about them. */
export function listEnded(ex: Executor, batch: { now: Date; size: number }) {
  return ex
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      audience: plans.audience,
      planPrice: plans.price,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        lt(subscriptions.endsAt, batch.now)
      )
    )
    .orderBy(asc(subscriptions.endsAt), asc(subscriptions.id))
    .limit(batch.size)
}

/** Ends one subscription if it is still active and over; answers whether it did. */
export function updateExpired(ex: Executor, change: { id: string; now: Date }) {
  return ex
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.id, change.id),
        eq(subscriptions.status, "active"),
        lt(subscriptions.endsAt, change.now)
      )
    )
    .returning({ id: subscriptions.id })
    .then((rows) => rows.length > 0)
}

/**
 * Up to `size` active paid subscriptions that end within the window and have not been announced
 * yet, locked until the transaction ends.
 */
export function lockExpiringUnnotified(
  ex: Executor,
  batch: { from: Date; until: Date; size: number }
) {
  return ex
    .select({ id: subscriptions.id, userId: subscriptions.userId })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        gt(plans.price, 0),
        gt(subscriptions.endsAt, batch.from),
        lte(subscriptions.endsAt, batch.until),
        isNull(subscriptions.expiringNotifiedAt)
      )
    )
    .limit(batch.size)
    .for("update", { of: subscriptions, skipLocked: true })
}

export function updateExpiringNotified(
  ex: Executor,
  change: { ids: string[]; at: Date }
) {
  return ex
    .update(subscriptions)
    .set({ expiringNotifiedAt: change.at })
    .where(inArray(subscriptions.id, change.ids))
}
