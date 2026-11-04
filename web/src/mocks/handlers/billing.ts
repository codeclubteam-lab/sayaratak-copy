import { promotionInputSchema } from "@sayaratak/shared/schemas/inputs"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  paymentSchema,
  planSchema,
  promotionPriceSchema,
  promotionSchema,
} from "@sayaratak/shared/schemas/billing"
import {
  checkoutSchema,
  meSubscriptionSchema,
  myPromotionsSchema,
} from "@sayaratak/shared/schemas/responses"
import { z } from "zod"

import { db, find, insert, newId, paginate } from "../db"
import { fail, needUser, pageParams, route } from "../http"
import {
  byNewest,
  activatePromotion,
  currentSubscription,
  listingById,
  listingLimit,
  listingUsage,
  nowIso,
  paymentReference,
  promotionPrice,
  promotionView,
  publicUser,
} from "../lib"
import type { UserRow } from "../types"
import { assertRoom } from "./ads"
import { storeUpload } from "./uploads"

// Enabled plans only. Individuals have none while individual subscriptions are off.
route("GET", "/plans", (c) => {
  const audience = c.query.get("audience")
  return z
    .array(planSchema)
    .parse(
      db.plans
        .filter(
          (p) =>
            p.enabled &&
            (!audience || p.audience === audience) &&
            (p.audience !== "user" ||
              db.settings.individualSubscriptionsEnabled)
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
    )
})

// The active subscription (else the pending one), its plan, and how much of the limit is used. No subscription means null: an individual then runs on the free limit.
// A featured credit buys one 7-day Featured.
const CREDIT_DAYS = 7
// A listing can be bumped again a day after its last bump.
const BUMP_WAIT_MS = 24 * 3_600_000
// Featured credits of the active subscription: its plan's count, less the credit promotions started since the period began.
function credits(userId: string) {
  const sub = currentSubscription(userId)
  const total =
    sub?.status === "active"
      ? (find(db.plans, sub.planId)?.featuredCredits ?? 0)
      : 0
  if (!sub || !total) return { total: 0, left: 0 }
  const mine = new Set(
    db.listings.filter((l) => l.ownerUserId === userId).map((l) => l.id)
  )
  const used = db.promotions.filter(
    (p) =>
      p.source === "credit" &&
      mine.has(p.listingId) &&
      (p.startsAt ?? "") >= sub.startsAt
  ).length
  return { total, left: Math.max(0, total - used) }
}

route("GET", "/me/subscription", (c) => {
  const user = needUser(c)
  const sub = currentSubscription(user.id)
  const used = listingUsage(user.id)
  return meSubscriptionSchema.parse({
    subscription: sub
      ? { ...sub, usage: { used, limit: sub.usage.limit } }
      : null,
    plan: sub ? (find(db.plans, sub.planId) ?? null) : null,
    usage: { used, limit: listingLimit(user.id) },
    credits: credits(user.id),
    reviewPlan: find(
      db.plans,
      db.payments.find(
        (p) =>
          p.userId === user.id &&
          p.itemType === "plan" &&
          p.status === "pending_review"
      )?.itemId ?? ""
    ),
  })
})

// "Keep the free plan": the paid plan picked in onboarding stops waiting for payment.
route("DELETE", "/me/chosen-plan", (c) => {
  const user = needUser(c)
  user.chosenPlanId = undefined
  return publicUser(user)
})

route("GET", "/me/payments", (c) => {
  const user = needUser(c)
  const { page, pageSize } = pageParams(c.query, 20)
  return pageOf(paymentSchema).parse(
    paginate(
      db.payments.filter((p) => p.userId === user.id).sort(byNewest),
      page,
      pageSize
    )
  )
})

const pendingFor = (userId: string, itemId: string) =>
  db.payments.find(
    (p) =>
      p.userId === userId &&
      p.itemId === itemId &&
      p.status === "pending_review"
  )

type ItemType = "plan" | "promotion" | "campaign"
const isItemType = (v: unknown): v is ItemType =>
  v === "plan" || v === "promotion" || v === "campaign"

// What a payment is for: a plan, an unpaid promotion of one of the payer's listings, or an unpaid banner campaign of the payer.
function itemFor(user: UserRow, itemType: ItemType, itemId: string) {
  if (itemType === "campaign") {
    const campaign = find(db.campaigns, itemId)
    if (!campaign) throw fail(404, "not_found")
    if (campaign.ownerId !== user.id) throw fail(403, "forbidden")
    // Under review once its receipt is sent: the checkout then shows the pending state, and a second send gets `payment_pending`.
    if (
      campaign.status !== "pending_payment" &&
      campaign.status !== "under_review"
    )
      throw fail(409, "exists")
    return {
      label: { ar: "حملة بانر إعلاني", en: "Banner campaign" },
      amount: campaign.amount,
      durationDays: campaign.weeks * 7,
    }
  }
  if (itemType === "plan") {
    const plan = find(db.plans, itemId)
    // Only an enabled plan of the payer's own role: a workshop cannot buy a dealer plan from a typed URL.
    if (!plan || !plan.enabled || plan.audience !== user.role)
      throw fail(404, "not_found")
    return {
      label: plan.name,
      amount: plan.price,
      durationDays: plan.durationDays,
    }
  }
  const promo = find(db.promotions, itemId)
  if (!promo) throw fail(404, "not_found")
  const listing = listingById(promo.listingId)
  if (listing.ownerUserId !== user.id) throw fail(403, "forbidden")
  if (promo.status !== "pending_payment") throw fail(409, "exists")
  return {
    label: { ar: listing.title, en: listing.title },
    amount: promotionPrice(promo)?.price ?? 0,
    durationDays: promo.durationDays,
  }
}

// multipart: itemType, itemId (a plan id or a promotion id), transactionRef, payerName, receipt (image, up to 5 MB).
route("POST", "/payments", async (c) => {
  const user = needUser(c)
  const form = await c.form()
  const itemType = form.get("itemType")
  const itemId = String(form.get("itemId") ?? "")
  const transactionRef = String(form.get("transactionRef") ?? "").trim()
  const payerName = String(form.get("payerName") ?? "").trim()
  const receipt = form.get("receipt")
  const fields: Record<string, string> = {}
  if (!isItemType(itemType)) fields.itemType = "validation.required"
  if (payerName.length < 2) fields.payerName = "validation.name_min"
  if (transactionRef.length < 4) fields.transactionRef = "validation.txn_min"
  if (!(receipt instanceof File)) fields.receipt = "validation.required"
  if (
    Object.keys(fields).length ||
    !(receipt instanceof File) ||
    !isItemType(itemType)
  )
    throw fail(422, "validation", fields)
  const item = itemFor(user, itemType, itemId)
  if (pendingFor(user.id, itemId)) throw fail(409, "payment_pending")
  const campaign =
    itemType === "campaign" ? find(db.campaigns, itemId) : undefined
  // The slots are taken only now, so check again that the pages still have room.
  if (campaign) assertRoom(campaign)
  const upload = await storeUpload(receipt)
  if (itemType === "plan") user.chosenPlanId = undefined
  const row = insert(db.payments, {
    id: newId("pay"),
    userId: user.id,
    itemType,
    itemId,
    itemLabel: item.label,
    amount: item.amount,
    method: "bankak_transfer" as const,
    reference: paymentReference(user.id, itemId),
    payerName,
    transactionRef,
    receiptUrl: upload.url,
    status: "pending_review" as const,
    createdAt: nowIso(),
  })
  if (campaign) {
    campaign.status = "under_review"
    delete campaign.rejectionReason
  }
  return paymentSchema.parse(row)
})

route("GET", "/promotion-prices", () =>
  z.array(promotionPriceSchema).parse(db.promotionPrices)
)

// A promotion starts as `pending_payment`; the admin's approval of its payment starts it. Asking again for the same listing and price row returns the unpaid one.
route("POST", "/promotions", async (c) => {
  const user = needUser(c)
  const { listingId, priceId, useCredit } = await c.body(promotionInputSchema)
  const listing = listingById(listingId)
  if (listing.ownerUserId !== user.id) throw fail(403, "forbidden")
  if (useCredit) {
    if (credits(user.id).left < 1) throw fail(409, "no_credits")
    const promo = insert(db.promotions, {
      id: newId("promo"),
      listingId,
      type: "featured" as const,
      status: "pending_payment" as const,
      durationDays: CREDIT_DAYS,
      source: "credit" as const,
    })
    activatePromotion(promo)
    return promotionSchema.parse(promo)
  }
  const price = find(db.promotionPrices, priceId ?? "")
  if (!price) throw fail(404, "not_found")
  const { type } = price
  if (
    type === "bump" &&
    listing.bumpedAt &&
    Date.now() - Date.parse(listing.bumpedAt) < BUMP_WAIT_MS
  )
    throw fail(409, "bump_wait")
  const unpaid = db.promotions.find(
    (p) =>
      p.listingId === listingId &&
      p.type === type &&
      p.durationDays === price.durationDays &&
      p.status === "pending_payment"
  )
  return promotionSchema.parse(
    unpaid ??
      insert(db.promotions, {
        id: newId("promo"),
        listingId,
        type,
        status: "pending_payment" as const,
        durationDays: price.durationDays,
        source: "paid" as const,
      })
  )
})

route("GET", "/me/promotions", (c) => {
  const user = needUser(c)
  const mine = new Set(
    db.listings.filter((l) => l.ownerUserId === user.id).map((l) => l.id)
  )
  const items = db.promotions
    .filter((p) => mine.has(p.listingId))
    .map(promotionView)
    // Waiting ones first, then the newest start.
    .sort((a, b) => (b.startsAt ?? "9").localeCompare(a.startsAt ?? "9"))
  return myPromotionsSchema.parse({ items })
})

// `item` is `plan:<planId>`, `promotion:<promotionId>` or `campaign:<campaignId>`.
route("GET", "/checkout", (c) => {
  const user = needUser(c)
  const [itemType, itemId = ""] = (c.query.get("item") ?? "").split(":")
  if (!isItemType(itemType)) throw fail(404, "not_found")
  const item = itemFor(user, itemType, itemId)
  return checkoutSchema.parse({
    itemType,
    itemId,
    itemLabel: item.label,
    amount: item.amount,
    durationDays: item.durationDays,
    reference: paymentReference(user.id, itemId),
    bankak: db.settings.bankakAccount,
    pendingPaymentId: pendingFor(user.id, itemId)?.id ?? null,
  })
})
