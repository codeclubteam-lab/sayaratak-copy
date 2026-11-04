import type { Plan } from "@sayaratak/shared/schemas/billing"
import { and, asc, desc, eq, gt, gte, inArray, ne } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { type NewSubscriptionRow, plans, subscriptions } from "./plans.tables"

export function getActiveSubscription(ex: Executor, userId: string) {
  return ex
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .then(([row]) => row)
}

/** The audience's free plan: its first plan, by list order, priced 0. */
export function getFreePlan(ex: Executor, audience: Plan["audience"]) {
  return ex
    .select()
    .from(plans)
    .where(and(eq(plans.audience, audience), eq(plans.price, 0)))
    .orderBy(asc(plans.sortOrder))
    .limit(1)
    .then(([row]) => row)
}

export function getPlan(ex: Executor, id: string) {
  return ex
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .then(([row]) => row)
}

/** Owners whose active subscription is to a plan that costs money and has not ended at `now`. */
export function listPaidOwnerIds(ex: Executor, now: Date) {
  return ex
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        gt(plans.price, 0),
        gte(subscriptions.endsAt, now)
      )
    )
    .then((rows) => rows.map((row) => row.userId))
}

export function updateActiveCanceled(ex: Executor, userId: string) {
  return ex
    .update(subscriptions)
    .set({ status: "canceled" })
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
}

export function insertSubscription(ex: Executor, row: NewSubscriptionRow) {
  return ex.insert(subscriptions).values(row)
}

/** Enabled plans in list order; `withUser` false leaves out the individuals' plans. */
export function listEnabled(
  ex: Executor,
  filter: { audience?: Plan["audience"]; withUser: boolean }
) {
  return ex
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.enabled, true),
        filter.audience ? eq(plans.audience, filter.audience) : undefined,
        filter.withUser ? undefined : ne(plans.audience, "user")
      )
    )
    .orderBy(asc(plans.sortOrder), asc(plans.id))
}

/** The account's active and pending subscriptions, newest start first. */
export function listCurrent(ex: Executor, userId: string) {
  return ex
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["active", "pending"])
      )
    )
    .orderBy(desc(subscriptions.startsAt))
}

export function countActive(ex: Executor) {
  return ex.$count(subscriptions, eq(subscriptions.status, "active"))
}

/** The active subscription of each of these accounts; an account with none is missing. */
export function listActiveSubscriptions(ex: Executor, userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([])
  return ex
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.status, "active")
      )
    )
}

export function listPlansByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex.select().from(plans).where(inArray(plans.id, ids))
}

/** Accounts with an active subscription to this plan, or to any plan when `planId` is not given. */
export function listActiveOwnerIds(ex: Executor, planId?: string) {
  return ex
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        planId ? eq(subscriptions.planId, planId) : undefined
      )
    )
    .then((rows) => rows.map((row) => row.userId))
}
