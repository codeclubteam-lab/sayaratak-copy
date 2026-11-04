import { clock } from "~/shared/time/clock"
import type { Executor } from "~/shared/db/tx"

import * as q from "./plans.queries"

const DAY_MS = 86_400_000

/**
 * What an account is entitled to *now* (A10): its stored active subscription and plan, except that
 * a paid plan whose end has passed counts as the audience's free plan from that moment. Access
 * follows the end date on every read; the `subscription-end` job only makes the stored rows say
 * the same afterwards. A free plan never lapses: it stays until the job renews it, so nobody is
 * left at 0 listings for the hour in between. Individuals have no free subscription (they fall
 * back to the free listing limit in the settings), so for them a lapsed paid plan is none.
 * Listing limit, caps, Featured credits and the paid boost all read this.
 */
export async function getStanding(ex: Executor, userId: string) {
  const subscription = await q.getActiveSubscription(ex, userId)
  if (!subscription) return undefined
  const plan = await q.getPlan(ex, subscription.planId)
  if (!plan) return undefined
  if (plan.price === 0 || subscription.endsAt >= clock.now())
    return { subscription, plan }
  if (plan.audience === "user") return undefined
  const free = await q.getFreePlan(ex, plan.audience)
  if (!free) return undefined
  // The free plan starts where the paid one ended, with its own price, limit and length.
  return {
    plan: free,
    subscription: {
      ...subscription,
      planId: free.id,
      price: free.price,
      listingLimit: free.listingLimit,
      startsAt: subscription.endsAt,
      endsAt: new Date(
        subscription.endsAt.getTime() + free.durationDays * DAY_MS
      ),
      note: null,
    },
  }
}
