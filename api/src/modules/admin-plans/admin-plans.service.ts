import type { AdminSubscription } from "@sayaratak/shared/schemas/admin"
import type { planInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { Actor } from "~/modules/audit/audit.types"
import * as auth from "~/modules/auth/auth.service"
import * as businesses from "~/modules/businesses/businesses.admin.service"
import * as listings from "~/modules/listings/listings.overview.service"
import * as admin from "~/modules/plans/plans.admin.service"
import * as subscriptions from "~/modules/plans/plans.subscriptions.admin.service"

type Created = z.output<typeof planInputSchema>

/** `GET /admin/plans`: every plan in list order. */
export function getAdminPlans() {
  return admin.listAdminPlans(db)
}

/** `POST /admin/plans`: the new plan. */
export function createPlan(actor: Actor, input: Created) {
  return transaction(async (tx) => {
    const id = await admin.createPlan(tx, actor, input)
    return viewOne(tx, id)
  })
}

/** `PATCH /admin/plans/:id`: the plan as it is after. */
export function updatePlan(
  actor: Actor,
  change: { id: string; edit: admin.PlanEdit }
) {
  return transaction(async (tx) => {
    await admin.updatePlan(tx, actor, change)
    return viewOne(tx, change.id)
  })
}

/** `DELETE /admin/plans/:id`. */
export function deletePlan(actor: Actor, id: string) {
  return transaction((tx) => admin.deletePlan(tx, actor, id))
}

/** `GET /admin/subscriptions`: every subscription newest first with its plan and holder. */
export async function getAdminSubscriptions(
  query: subscriptions.SubscriptionsQuery
) {
  const { rows, ...page } = await subscriptions.listAdminSubscriptions(
    db,
    query,
    await holdersNamed(query.q)
  )
  return { ...page, items: await toViews(db, rows) }
}

async function viewOne(ex: Executor, id: string) {
  const plan = (await admin.listAdminPlans(ex)).find((row) => row.id === id)
  if (!plan) fail.notFound()
  return plan
}

// The holder is the business when the account has one, else the person, so a business owner's
// own name does not match; each module finds its own ids.
async function holdersNamed(text: string | undefined) {
  const term = text?.trim().toLowerCase()
  if (!term) return undefined
  const [byBusiness, byName] = await Promise.all([
    businesses.listOwnerIdsNamed(db, term),
    auth.listIdsNamed(db, term),
  ])
  const owners = await businesses.getBusinessesOfOwners(db, byName)
  return [...byBusiness, ...byName.filter((id) => !owners.has(id))]
}

// Live listings count on an active subscription only; the holder's name is the business's, else the account's.
async function toViews(
  ex: Executor,
  rows: Awaited<ReturnType<typeof subscriptions.listAdminSubscriptions>>["rows"]
): Promise<AdminSubscription[]> {
  const userIds = rows.map((row) => row.subscription.userId)
  const [people, owned, live] = await Promise.all([
    auth.listPeople(ex, userIds),
    businesses.getBusinessesOfOwners(ex, userIds),
    listings.countLivePerOwner(ex, userIds),
  ])
  return rows.map(({ subscription, plan }) => {
    const business = owned.get(subscription.userId)
    const name = people.get(subscription.userId)?.name ?? ""
    const active = subscription.status === "active"
    return {
      ...subscriptions.toAdminSubscription(
        subscription,
        active ? (live.get(subscription.userId) ?? 0) : 0
      ),
      plan: { name: plan.name, audience: plan.audience },
      subscriber: {
        name: business?.name ?? { ar: name, en: name },
        ...(business && { businessId: business.id }),
      },
    }
  })
}
