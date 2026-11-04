import { planSchema } from "@sayaratak/shared/schemas/billing"

import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as content from "~/modules/content/content.service"
import { getListingUsage } from "~/modules/listings/listings.rules.service"
import * as payments from "~/modules/payments/payments.service"

import { getStanding } from "./plans.entitlement.service"
import { toPlan, toSubscription } from "./plans.mapper"
import * as q from "./plans.queries"
import { getCredits } from "./plans.service"

const AUDIENCES = planSchema.shape.audience.options

/**
 * `GET /plans`: enabled plans in list order, optionally for one audience.
 * Individuals have none while individual subscriptions are off; an unknown
 * audience matches nothing.
 */
export async function listPlans(audience?: string) {
  const settings = await content.getListingSettings(db)
  const known = AUDIENCES.find((a) => a === audience)
  if (audience && !known) return []
  const rows = await q.listEnabled(db, {
    audience: known,
    withUser: settings.individualSubscriptionsEnabled,
  })
  return rows.map(toPlan)
}

/**
 * `GET /me/subscription`: the active subscription, else the pending one, with
 * its plan, how much of the limit is used, the Featured credits left this
 * period and the plan whose receipt waits for review.
 */
export async function getMySubscription(user: SessionUser) {
  // The active one as it stands now (a paid plan past its end reads as the free plan), else the pending one.
  const standing = await getStanding(db, user.id)
  const pending = standing
    ? undefined
    : (await q.listCurrent(db, user.id)).find((s) => s.status === "pending")
  const sub = standing?.subscription ?? pending
  const [usage, plan, reviewPlan] = await Promise.all([
    getListingUsage(db, user),
    standing?.plan ?? (sub ? q.getPlan(db, sub.planId) : undefined),
    getReviewPlan(db, user.id),
  ])
  return {
    subscription: sub ? toSubscription(sub, usage.used) : null,
    plan: plan ? toPlan(plan) : null,
    usage,
    credits: await getCredits(db, {
      userId: user.id,
      sub,
      total: plan?.featuredCredits,
    }),
    reviewPlan,
  }
}

// A paid-for plan the admin has not decided on yet.
async function getReviewPlan(ex: Executor, userId: string) {
  const planId = await payments.getPlanUnderReviewId(ex, userId)
  const row = planId ? await q.getPlan(ex, planId) : undefined
  return row ? toPlan(row) : null
}

/** `DELETE /me/chosen-plan`: "keep the free plan"; the account as `GET /me` shows it. */
export function clearChosenPlan(user: SessionUser) {
  return auth.clearChosenPlan(db, user.id)
}
