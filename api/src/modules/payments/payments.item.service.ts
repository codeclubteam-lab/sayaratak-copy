import type { Payment } from "@sayaratak/shared/schemas/billing"

import type { Executor } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import * as ads from "~/modules/ads/ads.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import { getListingHead } from "~/modules/listings/listings.service"
import * as plans from "~/modules/plans/plans.service"
import * as promotions from "~/modules/promotions/promotions.service"

export type ItemType = Payment["itemType"]
const DAYS_PER_WEEK = 7
const HASH_MODULUS = 900_000
const REFERENCE_BASE = 100_000

/**
 * A stable code per payer and item, so the checkout and the payment show the
 * same one: `SY-` and six digits. Example: the same pair always gives the same code.
 */
export function paymentReference(userId: string, itemId: string) {
  let hash = 0
  for (const ch of `${userId}:${itemId}`)
    hash = (hash * 31 + ch.charCodeAt(0)) % HASH_MODULUS
  return `SY-${REFERENCE_BASE + hash}`
}

/**
 * What a payment is for: an enabled plan of the payer's own role, an unpaid
 * promotion of one of the payer's listings, or the payer's unpaid banner
 * campaign (also one already under review, so the checkout shows its state).
 * 404 for an unknown item, 403 for someone else's, 409 `exists` once paid.
 */
export async function getPayable(
  ex: Executor,
  user: SessionUser,
  item: { type: ItemType; id: string }
) {
  if (item.type === "campaign") return getCampaignItem(ex, user, item.id)
  if (item.type === "plan") return getPlanItem(ex, user, item.id)
  return getPromotionItem(ex, user, item.id)
}

async function getCampaignItem(ex: Executor, user: SessionUser, id: string) {
  const campaign = await ads.getCampaignToPay(ex, id)
  if (!campaign) fail.notFound()
  if (campaign.ownerId !== user.id) fail.forbidden()
  if (
    campaign.status !== "pending_payment" &&
    campaign.status !== "under_review"
  )
    fail.conflict("exists")
  return {
    label: { ar: "حملة بانر إعلاني", en: "Banner campaign" },
    amount: campaign.amount,
    durationDays: campaign.weeks * DAYS_PER_WEEK,
  }
}

async function getPlanItem(ex: Executor, user: SessionUser, id: string) {
  const plan = await plans.getPlan(ex, id)
  // A workshop cannot buy a dealership plan from a typed address.
  if (!plan?.enabled || plan.audience !== user.role) fail.notFound()
  return {
    label: plan.name,
    amount: plan.price,
    durationDays: plan.durationDays,
  }
}

async function getPromotionItem(ex: Executor, user: SessionUser, id: string) {
  const promo = await promotions.getPromotionToPay(ex, id)
  if (!promo) fail.notFound()
  const listing = await getListingHead(ex, promo.listingId)
  if (listing?.ownerUserId !== user.id) fail.forbidden()
  if (promo.status !== "pending_payment") fail.conflict("exists")
  return {
    label: { ar: listing.title, en: listing.title },
    amount: promo.price,
    durationDays: promo.durationDays,
  }
}
