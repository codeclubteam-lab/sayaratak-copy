import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import type { planInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import * as content from "~/modules/content/content.service"
import { listPlanIdsPaidFor } from "~/modules/payments/payments.service"

import { toPlan } from "./plans.mapper"
import * as q from "./plans.admin.queries"
import type { PlanRow } from "./plans.admin.queries"

const ID_PREFIX = "plan"
const CAPS = [
  "listingLimit",
  "serviceLimit",
  "photoLimit",
  "portfolioLimit",
] as const

type PlanInput = z.output<typeof planInputSchema>
/** What an edit sends: any field but the audience, which never changes. A cap sent as `null` is taken off. */
export type PlanEdit = Partial<Omit<PlanInput, "audience">>

/** Every plan in list order with whether it is the free one, whether billing history names it and how many hold it now. */
export async function listAdminPlans(ex: Executor): Promise<AdminPlan[]> {
  // Independent reads.
  const [rows, counts, paidIds] = await Promise.all([
    q.listAll(ex),
    q.countByPlan(ex),
    listPlanIdsPaidFor(ex),
  ])
  const countOf = new Map(counts.map((row) => [row.planId, row]))
  const paid = new Set(paidIds)
  const freeIds = freeIdsOf(rows)
  return rows.map((row) => ({
    ...toPlan(row),
    free: freeIds.has(row.id),
    inUse: paid.has(row.id) || (countOf.get(row.id)?.total ?? 0) > 0,
    subscribers: countOf.get(row.id)?.active ?? 0,
  }))
}

/**
 * Adds a plan. The individuals' free plan always shows the free-listing
 * setting (`syncFreeLimit`), whatever limit it was given.
 */
export async function createPlan(
  tx: Transaction,
  actor: Actor,
  input: PlanInput
) {
  const row = {
    id: newId(ID_PREFIX),
    audience: input.audience,
    name: input.name,
    price: input.price,
    durationDays: input.durationDays,
    ...capsOf(input),
    features: input.features,
    featuredCredits: input.featuredCredits,
    enabled: input.enabled,
    sortOrder: input.sortOrder,
  }
  await q.insertPlan(tx, row)
  await syncFreeLimit(tx)
  await recordAudit(tx, actor, {
    action: "plan.create",
    targetType: "plan",
    targetId: row.id,
    after: row,
  })
  return row.id
}

/**
 * Changes a plan. The audience never changes. The free plan of an audience
 * keeps its price of 0 and stays on: 409 `in_use` otherwise. Existing
 * subscriptions keep the price and limit they were started with.
 */
export async function updatePlan(
  tx: Transaction,
  actor: Actor,
  change: { id: string; edit: PlanEdit }
) {
  const row = await q.lockPlan(tx, change.id)
  if (!row) fail.notFound()
  const { edit } = change
  if (
    (await isFree(tx, row)) &&
    ((edit.price ?? 0) > 0 || edit.enabled === false)
  )
    fail.conflict("in_use")
  const set = setOf(edit)
  if (Object.keys(set).length > 0) await q.updatePlan(tx, { id: row.id, set })
  await syncFreeLimit(tx)
  await recordAudit(tx, actor, {
    action: "plan.update",
    targetType: "plan",
    targetId: row.id,
    before: Object.fromEntries(
      Object.keys(set).map((key) => [key, row[key as keyof PlanRow]])
    ),
    after: set,
  })
}

/**
 * Deletes a plan nobody holds. Refused (409 `in_use`) while any subscription
 * or receipt names it, because billing history keeps its name, and for the
 * free plan of an audience. Accounts that picked it in onboarding keep the free plan.
 */
export async function deletePlan(tx: Transaction, actor: Actor, id: string) {
  const row = await q.lockPlan(tx, id)
  if (!row) fail.notFound()
  const [counts, paidIds, free] = await Promise.all([
    q.countByPlan(tx),
    listPlanIdsPaidFor(tx),
    isFree(tx, row),
  ])
  const held = counts.some((count) => count.planId === id)
  if (held || paidIds.includes(id) || free) fail.conflict("in_use")
  await q.deletePlan(tx, id)
  await recordAudit(tx, actor, {
    action: "plan.delete",
    targetType: "plan",
    targetId: id,
    before: toPlan(row),
  })
}

/**
 * The individuals' free plan shows the "free listings per user" setting as
 * its limit; the plan only displays it. Called after every plan write and
 * after that setting changes.
 */
export async function syncFreeLimit(tx: Transaction) {
  const [free, settings] = await Promise.all([
    q.getFreePlan(tx, "user"),
    content.getListingSettings(tx),
  ])
  if (free && free.listingLimit !== settings.freeListingLimit)
    await q.updatePlan(tx, {
      id: free.id,
      set: { listingLimit: settings.freeListingLimit },
    })
}

// The first plan priced 0 of each audience, by list order.
function freeIdsOf(rows: PlanRow[]) {
  const free = new Map<string, string>()
  for (const row of rows)
    if (row.price === 0 && !free.has(row.audience))
      free.set(row.audience, row.id)
  return new Set(free.values())
}

async function isFree(ex: Executor, row: PlanRow) {
  return (await q.getFreePlan(ex, row.audience))?.id === row.id
}

// A cap sent as null is taken off; a cap left out stays.
function capsOf(input: Partial<Pick<PlanInput, (typeof CAPS)[number]>>) {
  return Object.fromEntries(
    CAPS.flatMap((cap) => (input[cap] === undefined ? [] : [[cap, input[cap]]]))
  ) as Partial<Record<(typeof CAPS)[number], number | null>>
}

function setOf(edit: PlanEdit) {
  const { listingLimit, serviceLimit, photoLimit, portfolioLimit, ...rest } =
    edit
  return {
    ...Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined)
    ),
    ...capsOf({ listingLimit, serviceLimit, photoLimit, portfolioLimit }),
  } as Partial<PlanRow>
}
