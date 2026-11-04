import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm"

import type { Plan } from "@sayaratak/shared/schemas/billing"

import type { Executor, Transaction } from "~/shared/db/tx"

import {
  type NewPlanRow,
  type PlanRow,
  plans,
  type SubscriptionRow,
  subscriptions,
} from "./plans.tables"

/** Every plan in list order, the disabled ones too. */
export function listAll(ex: Executor) {
  return ex.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.id))
}

/** The plan, held until the transaction ends: an edit, a delete and a new subscription queue up. */
export function lockPlan(tx: Transaction, id: string) {
  return tx
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .for("update")
    .then(([row]) => row)
}

export function insertPlan(ex: Executor, row: NewPlanRow) {
  return ex.insert(plans).values(row)
}

/** The audience's free plan: its first plan, by list order, priced 0. */
export function getFreePlan(ex: Executor, audience: Plan["audience"]) {
  return ex
    .select()
    .from(plans)
    .where(and(eq(plans.audience, audience), eq(plans.price, 0)))
    .orderBy(asc(plans.sortOrder), asc(plans.id))
    .limit(1)
    .then(([row]) => row)
}

export function updatePlan(
  ex: Executor,
  change: { id: string; set: Partial<PlanRow> }
) {
  return ex.update(plans).set(change.set).where(eq(plans.id, change.id))
}

export function deletePlan(ex: Executor, id: string) {
  return ex.delete(plans).where(eq(plans.id, id))
}

/** How many subscriptions each plan has, in any state, and how many are active. A plan with none is missing. */
export function countByPlan(ex: Executor) {
  return ex
    .select({
      planId: subscriptions.planId,
      total: count(),
      active:
        sql<number>`count(*) filter (where ${subscriptions.status} = 'active')`.mapWith(
          Number
        ),
    })
    .from(subscriptions)
    .groupBy(subscriptions.planId)
}

/** The subscriptions table's filters as the mock reads them; empty means not set. */
export type SubscriptionFilters = {
  audience?: string
  planId?: string
  /** Compared as text: an unknown status matches nothing instead of failing the enum cast. */
  status?: string
  /** With a text search: the accounts whose holder name matches. */
  holderIds?: string[]
  page: { offset: number; size: number }
}

/** One page of subscriptions with their plan and the total, newest start first, ties in the mock's id order. */
export async function listSubscriptionsForAdmin(
  ex: Executor,
  find: SubscriptionFilters
) {
  const where = and(
    find.audience ? sql`${plans.audience}::text = ${find.audience}` : undefined,
    find.planId ? eq(subscriptions.planId, find.planId) : undefined,
    find.status
      ? sql`${subscriptions.status}::text = ${find.status}`
      : undefined,
    find.holderIds
      ? inArray(subscriptions.userId, [...find.holderIds, ""])
      : undefined
  )
  const rows = await ex
    .select({
      subscription: subscriptions,
      plan: { name: plans.name, audience: plans.audience },
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(where)
    .orderBy(
      desc(subscriptions.startsAt),
      asc(sql`length(${subscriptions.id})`),
      asc(subscriptions.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? 0
  return {
    rows: rows.map(({ subscription, plan }) => ({ subscription, plan })),
    total,
  }
}

export type { NewPlanRow, PlanRow, SubscriptionRow }

export type SubscriptionWithPlan = {
  subscription: SubscriptionRow
  plan: Pick<PlanRow, "name" | "audience">
}
