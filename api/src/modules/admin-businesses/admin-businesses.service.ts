import type {
  assignPlanInputSchema,
  businessAdminPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import * as auth from "~/modules/auth/auth.service"
import * as businesses from "~/modules/businesses/businesses.admin.service"
import { reviewBusiness } from "~/modules/businesses/businesses.review.service"
import type { BusinessKind } from "~/modules/businesses/businesses.types"
import { notify } from "~/modules/notifications/notifications.service"
import * as plans from "~/modules/plans/plans.service"

import { toViews } from "./admin-businesses.view.service"

const KINDS: BusinessKind[] = ["dealership", "workshop", "mechanic"]

type AssignInput = z.output<typeof assignPlanInputSchema>

/** `GET /admin/businesses`: a page of dealerships, workshops and mechanics, each with owner, plan and rating. */
export async function getAdminBusinesses(query: businesses.BusinessesQuery) {
  const { rows, ...page } = await businesses.listAdminBusinesses(
    db,
    query,
    await scopeOf(query)
  )
  return { ...page, items: await toViews(db, rows) }
}

/** `PATCH /admin/businesses/:id`: the business as it is after. */
export function updateBusiness(
  actor: Actor,
  change: { id: string; patch: z.output<typeof businessAdminPatchSchema> }
) {
  return transaction(async (tx) => {
    await reviewBusiness(tx, actor, change)
    return viewOne(tx, change.id)
  })
}

/**
 * `POST /admin/businesses/:id/assign-plan`: ends the owner's active subscription
 * and starts the plan now. Price, listing limit and length left out take the
 * plan's own; only a dealership has a listing limit. 404 for an unknown business
 * or plan, 422 when the plan is for another kind of business.
 */
export function assignPlan(
  actor: Actor,
  change: { id: string; input: AssignInput }
) {
  return transaction(async (tx) => {
    // The business lock queues two admins on the same owner.
    const business = await businesses.lockBusinessById(tx, change.id)
    const plan = await plans.getPlan(tx, change.input.planId)
    if (!plan) fail.notFound()
    if (plan.audience !== business.kind)
      fail.validation({ planId: "validation.required" })
    const [before] = (
      await plans.getActiveSubscriptions(tx, [business.ownerUserId])
    ).values()
    const start = {
      userId: business.ownerUserId,
      plan,
      price: change.input.price ?? plan.price,
      listingLimit: listingLimitOf(business.kind, plan, change.input),
      durationDays: change.input.durationDays ?? plan.durationDays,
      note: change.input.note,
    }
    await plans.startSubscription(tx, start)
    await recordAudit(tx, actor, {
      action: "business.assign_plan",
      targetType: "business",
      targetId: business.id,
      before: { planId: before?.planId ?? null },
      after: {
        planId: plan.id,
        price: start.price,
        listingLimit: start.listingLimit,
      },
    })
    await notify(tx, {
      userId: business.ownerUserId,
      type: "business_status",
      title: { ar: "تغيّرت باقتك", en: "Your plan changed" },
      body: {
        ar: `أنت الآن على باقة ${plan.name.ar}.`,
        en: `You are now on ${plan.name.en}.`,
      },
      href: "/billing",
    })
    return viewOne(tx, business.id)
  })
}

// Only a dealership has a listing limit; an empty custom limit takes the plan's own, `null` means no cap.
function listingLimitOf(
  kind: BusinessKind,
  plan: { listingLimit: number | null },
  input: AssignInput
) {
  if (kind !== "dealership") return null
  return input.limit === undefined ? plan.listingLimit : input.limit
}

// The id lists a filter needs from other modules; each is read only when asked.
async function scopeOf(query: businesses.BusinessesQuery) {
  const term = query.q?.trim().toLowerCase()
  const [namedOwnerIds, owners] = await Promise.all([
    term ? auth.listIdsNamed(db, term) : [],
    ownersOnPlan(query.planId),
  ])
  return { namedOwnerIds, owners }
}

async function ownersOnPlan(planId: string | undefined) {
  if (!planId) return {}
  const found = await Promise.all(
    KINDS.map(
      async (kind) =>
        [
          kind,
          await plans.getPlanOwnerFilter(db, { planId, audience: kind }),
        ] as const
    )
  )
  return Object.fromEntries(found)
}

async function viewOne(ex: Executor, id: string) {
  const row = await businesses.findAdminBusiness(ex, id)
  if (!row) throw new Error("business vanished after a change")
  const [view] = await toViews(ex, [row])
  if (!view) throw new Error("business view is empty")
  return view
}
