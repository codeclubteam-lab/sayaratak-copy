import type { Plan } from "@sayaratak/shared/schemas/billing"

import type { Executor } from "~/shared/db/tx"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import { listIdsOf } from "~/modules/listings/listings.stats.service"
import * as promotions from "~/modules/promotions/promotions.service"

import { getStanding } from "./plans.entitlement.service"
import * as q from "./plans.queries"

const DAY_MS = 86_400_000
const SUBSCRIPTION_ID_PREFIX = "sub"

/**
 * The account's subscription as it stands now (see `getStanding`): a paid plan past its end reads
 * as the audience's free plan at once, a free one stays until the job renews it.
 */
export async function getActiveSubscription(ex: Executor, userId: string) {
  return (await getStanding(ex, userId))?.subscription
}

/** The plan the account is on now: where its caps come from (photos, services, portfolio). */
export async function getActivePlan(ex: Executor, userId: string) {
  return (await getStanding(ex, userId))?.plan
}

/** Owners on a paid plan that has not ended: Plus promises mechanics "Top of search". */
export async function listPaidOwnerIds(ex: Executor) {
  return new Set(await q.listPaidOwnerIds(ex, clock.now()))
}

/**
 * Starts the audience's free plan without payment (handoff "Plans, limits and
 * credits"), after ending any subscription the account still has. Price and
 * listing limit are copied from the plan. An audience with no free plan starts nothing.
 */
export async function startFreeSubscription(
  ex: Executor,
  account: { userId: string; audience: Plan["audience"] }
) {
  const plan = await q.getFreePlan(ex, account.audience)
  if (!plan) return
  await startSubscription(ex, {
    userId: account.userId,
    plan,
    price: plan.price,
    listingLimit: plan.listingLimit,
    durationDays: plan.durationDays,
  })
}

/**
 * Ends the account's active subscription and starts a new one to `plan` at
 * once. Price, listing limit and length are the values to keep (the plan's own,
 * or an admin's custom ones). The caller holds the account's lock, so two
 * starts cannot both pass the one-active-subscription index.
 */
export async function startSubscription(
  ex: Executor,
  start: {
    userId: string
    plan: { id: string }
    price: number
    listingLimit: number | null
    durationDays: number
    note?: string
  }
) {
  const now = clock.now()
  await q.updateActiveCanceled(ex, start.userId)
  await q.insertSubscription(ex, {
    id: newId(SUBSCRIPTION_ID_PREFIX),
    userId: start.userId,
    planId: start.plan.id,
    status: "active",
    startsAt: now,
    endsAt: new Date(now.getTime() + start.durationDays * DAY_MS),
    price: start.price,
    listingLimit: start.listingLimit,
    note: start.note,
  })
}

/**
 * The id of a plan an account may pick in onboarding and pay for later:
 * enabled, priced above 0, for its own audience. Anything else is undefined.
 */
export async function getPickablePaidPlanId(
  ex: Executor,
  pick: { planId: string; audience: Plan["audience"] }
) {
  const plan = await q.getPlan(ex, pick.planId)
  const ok = plan?.enabled && plan.price > 0 && plan.audience === pick.audience
  return ok ? plan.id : undefined
}

/** One plan by id, or undefined. */
export function getPlan(ex: Executor, id: string) {
  return q.getPlan(ex, id)
}

/**
 * The Featured credits of an active subscription: its plan's count, less the
 * credit promotions of the owner's listings started since the period began.
 * Nothing without an active subscription or credits.
 */
export async function getCredits(
  ex: Executor,
  of: {
    userId: string
    sub?: { status: string; startsAt: Date }
    total?: number
  }
) {
  const { sub, total = 0 } = of
  if (sub?.status !== "active" || total === 0) return { total: 0, left: 0 }
  const used = await promotions.countCreditsUsed(ex, {
    listingIds: await listIdsOf(ex, of.userId),
    since: sub.startsAt,
  })
  return { total, left: Math.max(0, total - used) }
}

/** The account's Featured credits now (`GET /me/subscription` shows the same). */
export async function getCreditsOf(ex: Executor, userId: string) {
  const standing = await getStanding(ex, userId)
  return getCredits(ex, {
    userId,
    sub: standing?.subscription,
    total: standing?.plan.featuredCredits,
  })
}

/** Accounts on an active plan, the free one included. */
export function countActiveSubscriptions(ex: Executor) {
  return q.countActive(ex)
}

/** The active subscription of each account, keyed by account id; an account with none is missing. */
export async function getActiveSubscriptions(ex: Executor, userIds: string[]) {
  const rows = await q.listActiveSubscriptions(ex, userIds)
  return new Map(rows.map((row) => [row.userId, row]))
}

/** The plans with these ids, keyed by id. */
export async function getPlans(ex: Executor, ids: string[]) {
  const rows = await q.listPlansByIds(ex, ids)
  return new Map(rows.map((row) => [row.id, row]))
}

/** The audience's free plan: its first plan by list order, priced 0. */
export function getFreePlan(ex: Executor, audience: Plan["audience"]) {
  return q.getFreePlan(ex, audience)
}

/**
 * Which accounts show a plan: `in` the accounts with an active subscription to
 * it, or, for the audience's free plan (what an account without a subscription
 * shows), `notIn` the accounts whose active subscription is to another plan.
 */
export async function getPlanOwnerFilter(
  ex: Executor,
  of: { planId: string; audience: Plan["audience"] }
): Promise<{ in: string[] } | { notIn: string[] }> {
  const free = await q.getFreePlan(ex, of.audience)
  if (free?.id !== of.planId)
    return { in: await q.listActiveOwnerIds(ex, of.planId) }
  const [all, onPlan] = await Promise.all([
    q.listActiveOwnerIds(ex),
    q.listActiveOwnerIds(ex, of.planId),
  ])
  const onThis = new Set(onPlan)
  return { notIn: all.filter((id) => !onThis.has(id)) }
}
