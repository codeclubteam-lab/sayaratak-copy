import type { Plan } from "@sayaratak/shared/schemas/billing"

import { transaction, type Transaction } from "~/shared/db/tx"
import { drain } from "~/shared/jobs/batches"
import { clock } from "~/shared/time/clock"
import { lockUser } from "~/modules/auth/auth.service"
import { notify } from "~/modules/notifications/notifications.service"

import * as q from "./plans.expiry.queries"
import { startFreeSubscription } from "./plans.service"

const EXPIRING_DAYS = 3
const DAY_MS = 86_400_000

type Ended = {
  id: string
  userId: string
  audience: Plan["audience"]
  planPrice: number
}

/**
 * Ends the subscriptions whose period is over (A10, handoff "Plans, limits and credits"). A free
 * plan renews itself; a paid one drops to the audience's free plan, so a dealership never ends up
 * with no cap. Individuals have no free subscription (they fall back to the free listing limit in
 * the settings), so a paid one simply ends. An account whose subscription changed since the list
 * was read (a payment was approved) is left alone. Answers how many subscriptions it looked at.
 */
export function endExpired(size?: number) {
  return drain(
    (limit) =>
      transaction(async (tx) => {
        const ended = await q.listEnded(tx, { now: clock.now(), size: limit })
        for (const subscription of ended) await endOne(tx, subscription)
        return ended.length
      }),
    size
  )
}

/**
 * Tells the owner of each paid subscription once, about three days before it ends. A free plan
 * renews itself and says nothing. `expiringNotifiedAt` is on the subscription, so a renewal (a
 * new row) is told again at its own end. Answers how many it told.
 */
export function notifyExpiring(size?: number) {
  return drain(
    (limit) =>
      transaction(async (tx) => {
        const now = clock.now()
        const until = new Date(now.getTime() + EXPIRING_DAYS * DAY_MS)
        const due = await q.lockExpiringUnnotified(tx, {
          from: now,
          until,
          size: limit,
        })
        for (const subscription of due) {
          await notify(tx, {
            userId: subscription.userId,
            type: "subscription_expiring",
            title: {
              ar: "اشتراكك على وشك الانتهاء",
              en: "Your plan is about to end",
            },
            body: {
              ar: "جدد اشتراكك لتستمر في النشر.",
              en: "Renew to keep posting.",
            },
            href: "/billing",
          })
        }
        if (due.length > 0) {
          await q.updateExpiringNotified(tx, {
            ids: due.map((subscription) => subscription.id),
            at: now,
          })
        }
        return due.length
      }),
    size
  )
}

async function endOne(tx: Transaction, subscription: Ended) {
  // The account row first, as every other change of a subscription does (A1 rule 16): an approved
  // payment and this job cannot both start a plan, which the one-active index would refuse.
  await lockUser(tx, subscription.userId)
  const ended = await q.updateExpired(tx, {
    id: subscription.id,
    now: clock.now(),
  })
  if (!ended) return
  const keepsNoPlan =
    subscription.audience === "user" && subscription.planPrice > 0
  if (keepsNoPlan) return
  await startFreeSubscription(tx, subscription)
}
