import type { Payment } from "@sayaratak/shared/schemas/billing"
import type { AdminPayment } from "@sayaratak/shared/schemas/responses"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import type { Actor } from "~/modules/audit/audit.types"
import * as ads from "~/modules/ads/ads.service"
import * as auth from "~/modules/auth/auth.service"
import * as listings from "~/modules/listings/listings.stats.service"
import * as payments from "~/modules/payments/payments.admin.service"
import {
  approvePayment,
  rejectPayment,
} from "~/modules/payments/payments.decide.service"
import * as plans from "~/modules/plans/plans.service"
import * as promotions from "~/modules/promotions/promotions.service"

const DAYS_PER_WEEK = 7

/** `GET /admin/payments`: a page of payments with the payer and what approval starts, and the strip above the table. */
export async function getAdminPayments(query: payments.PaymentsQuery) {
  const { items, ...rest } = await payments.listAdminPayments(db, query)
  return { ...rest, items: await toAdminPayments(db, items) }
}

/** `POST /admin/payments/:id/approve`: the payment as it is after (without the admin extras); the plan, promotion or campaign it paid for starts. */
export function approve(actor: Actor, id: string) {
  return transaction(async (tx) => {
    await approvePayment(tx, actor, id)
    return viewOne(tx, id)
  })
}

/** `POST /admin/payments/:id/reject`: the payment as it is after, with the reason. */
export function reject(actor: Actor, change: { id: string; reason: string }) {
  return transaction(async (tx) => {
    await rejectPayment(tx, actor, change)
    return viewOne(tx, change.id)
  })
}

async function viewOne(ex: Executor, id: string) {
  const { items } = await payments.listAdminPayments(ex, { id })
  const [payment] = items
  if (!payment) throw new Error("payment vanished after a decision")
  return payment
}

// The payer's name and the order come from their own modules, in independent reads.
async function toAdminPayments(
  ex: Executor,
  items: Payment[]
): Promise<AdminPayment[]> {
  const idsOf = (type: Payment["itemType"]) =>
    items.filter((p) => p.itemType === type).map((p) => p.itemId)
  const [people, planOf, weeksOf, promotionOf] = await Promise.all([
    auth.listPeople(
      ex,
      items.map((p) => p.userId)
    ),
    plans.getPlans(ex, idsOf("plan")),
    ads.getCampaignWeeks(ex, idsOf("campaign")),
    promotions.getPromotions(ex, idsOf("promotion")),
  ])
  const cards = await listings.listCards(
    ex,
    [...promotionOf.values()].map((promotion) => promotion.listingId)
  )
  const listingOf = new Map(cards.map((card) => [card.id, card]))
  return items.map((payment) => ({
    ...payment,
    user: {
      id: payment.userId,
      name: people.get(payment.userId)?.name ?? payment.payerName,
    },
    order: orderOf(payment, { planOf, weeksOf, promotionOf, listingOf }),
  }))
}

type Found = {
  planOf: Awaited<ReturnType<typeof plans.getPlans>>
  weeksOf: Awaited<ReturnType<typeof ads.getCampaignWeeks>>
  promotionOf: Awaited<ReturnType<typeof promotions.getPromotions>>
  listingOf: Map<string, { slug: string; title: string }>
}

// What approval starts: the plan's or promotion's days, the campaign's weeks.
function orderOf(payment: Payment, found: Found): AdminPayment["order"] {
  if (payment.itemType === "plan")
    return { durationDays: found.planOf.get(payment.itemId)?.durationDays ?? 0 }
  if (payment.itemType === "campaign")
    return {
      durationDays: (found.weeksOf.get(payment.itemId) ?? 0) * DAYS_PER_WEEK,
    }
  const promotion = found.promotionOf.get(payment.itemId)
  const listing = promotion && found.listingOf.get(promotion.listingId)
  return {
    durationDays: promotion?.durationDays ?? 0,
    ...(promotion && { promotionType: promotion.type }),
    ...(listing && { listing: { slug: listing.slug, title: listing.title } }),
  }
}
