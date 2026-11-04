import type { z } from "zod"
import {
  type BroadcastAudience,
  broadcastSchema,
} from "@sayaratak/shared/schemas/api"
import {
  paymentSchema,
  type Payment,
  promotionPriceSchema,
} from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  adminPaymentsPageSchema,
  estimateSchema,
  myPromotionSchema,
} from "@sayaratak/shared/schemas/responses"
import {
  broadcastEstimateQuerySchema,
  broadcastInputSchema,
  grantInputSchema,
  rejectInputSchema,
} from "@sayaratak/shared/schemas/inputs"

import { db, find, insert, newId } from "../db"
import {
  fail,
  needRole,
  queryObject,
  route,
  zodFields,
  type Ctx,
} from "../http"
import {
  DAY_MS,
  activatePromotion,
  businessOf,
  byNewest,
  listPage,
  listingById,
  nowIso,
  notify,
  promotionView,
  textOf,
} from "../lib"
import type { PromotionPriceRow } from "../types"

const admin = (c: Ctx) => needRole(c, "admin")
const paymentOf = (id: string) => {
  const row = find(db.payments, id)
  if (!row) throw fail(404, "not_found")
  if (row.status !== "pending_review") throw fail(409, "exists")
  return row
}
// An admin grant starts at once and costs nothing.
function grantPromotion(
  listingId: string,
  type: PromotionPriceRow["type"],
  days: number
) {
  listingById(listingId)
  const promotion = insert(db.promotions, {
    id: newId("promo"),
    listingId,
    type,
    status: "active" as const,
    durationDays: type === "bump" ? 0 : days,
    source: "admin_grant" as const,
  })
  activatePromotion(promotion)
  return promotion
}

const khartoumMonth = (iso: string) =>
  new Date(iso)
    .toLocaleDateString("en-CA", { timeZone: "Africa/Khartoum" })
    .slice(0, 7)

// What approval of a payment starts: the plan's or promotion's days, the campaign's weeks.
function orderOf(p: Payment) {
  if (p.itemType === "plan")
    return { durationDays: find(db.plans, p.itemId)?.durationDays ?? 0 }
  if (p.itemType === "campaign")
    return { durationDays: (find(db.campaigns, p.itemId)?.weeks ?? 0) * 7 }
  const promotion = find(db.promotions, p.itemId)
  const listing = promotion && find(db.listings, promotion.listingId)
  return {
    durationDays: promotion?.durationDays ?? 0,
    promotionType: promotion?.type,
    listing: listing && { slug: listing.slug, title: listing.title },
  }
}

// A page of payments with the payer's name, plus the strip above the table: approved this month (Khartoum calendar), and what waits for review.
route("GET", "/admin/payments", (c) => {
  admin(c)
  const rows = db.payments
    .filter((p) => !c.query.get("status") || p.status === c.query.get("status"))
    .filter((p) => !c.query.get("userId") || p.userId === c.query.get("userId"))
    .filter((p) => !c.query.get("id") || p.id === c.query.get("id"))
    .sort(byNewest)
  const page = listPage(
    c,
    rows,
    (p) =>
      `${p.reference} ${p.transactionRef} ${p.itemLabel.ar} ${p.itemLabel.en}`
  )
  const month = khartoumMonth(nowIso())
  const waiting = db.payments.filter((p) => p.status === "pending_review")
  return adminPaymentsPageSchema.parse({
    ...page,
    items: page.items.map((p) => ({
      ...p,
      user: {
        id: p.userId,
        name: find(db.users, p.userId)?.fullName ?? p.payerName,
      },
      order: orderOf(p),
    })),
    summary: {
      approvedThisMonth: db.payments
        .filter(
          (p) =>
            p.status === "approved" &&
            khartoumMonth(p.reviewedAt ?? p.createdAt) === month
        )
        .reduce((sum, p) => sum + p.amount, 0),
      pendingCount: waiting.length,
      pendingAmount: waiting.reduce((sum, p) => sum + p.amount, 0),
    },
  })
})
// Approval activates the plan or adds the promotion, then tells the payer.
route("POST", "/admin/payments/:id/approve", (c) => {
  admin(c)
  const row = paymentOf(c.params.id ?? "")
  if (row.itemType === "plan") {
    const plan = find(db.plans, row.itemId)
    if (!plan) throw fail(404, "not_found")
    for (const s of db.subscriptions)
      if (s.userId === row.userId && s.status === "active")
        s.status = "canceled"
    insert(db.subscriptions, {
      id: newId("sub"),
      userId: row.userId,
      planId: plan.id,
      status: "active",
      startsAt: nowIso(),
      endsAt: new Date(Date.now() + plan.durationDays * DAY_MS).toISOString(),
      price: plan.price,
      usage: { used: 0, limit: plan.listingLimit ?? null },
    })
  } else if (row.itemType === "campaign") {
    const campaign = find(db.campaigns, row.itemId)
    if (campaign?.status === "under_review") campaign.status = "approved"
  } else {
    const promotion = find(db.promotions, row.itemId)
    if (!promotion) throw fail(404, "not_found")
    if (promotion.status === "pending_payment") {
      promotion.paymentId = row.id
      activatePromotion(promotion)
    }
  }
  row.status = "approved"
  row.reviewedAt = nowIso()
  notify(
    row.userId,
    "payment_approved",
    { ar: "تمت الموافقة على الدفع", en: "Payment approved" },
    row.itemLabel,
    "/billing"
  )
  return paymentSchema.parse(row)
})
route("POST", "/admin/payments/:id/reject", async (c) => {
  admin(c)
  const row = paymentOf(c.params.id ?? "")
  const { reason } = await c.body(rejectInputSchema)
  row.status = "rejected"
  row.rejectionReason = reason
  row.reviewedAt = nowIso()
  // A refused receipt sends the campaign back to unpaid: the advertiser can pay again.
  const campaign =
    row.itemType === "campaign" ? find(db.campaigns, row.itemId) : undefined
  if (campaign?.status === "under_review") campaign.status = "pending_payment"
  // A refused plan receipt brings the plan back as the one waiting for payment.
  const payer = find(db.users, row.userId)
  if (row.itemType === "plan" && payer) payer.chosenPlanId = row.itemId
  notify(
    row.userId,
    "payment_rejected",
    { ar: "تم رفض الدفع", en: "Payment rejected" },
    { ar: reason, en: reason },
    "/billing"
  )
  return paymentSchema.parse(row)
})

const priceInput = promotionPriceSchema.pick({
  price: true,
  durationDays: true,
})
route(
  "GET",
  "/admin/promotion-prices",
  (c) => (
    admin(c),
    db.promotionPrices.map((p) => promotionPriceSchema.parse(p))
  )
)
route("PATCH", "/admin/promotion-prices/:id", async (c) => {
  admin(c)
  const row = find(db.promotionPrices, c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  const { price, durationDays } = await c.body(priceInput.partial())
  Object.assign(row, {
    price: price ?? row.price,
    // A bump has no length.
    durationDays: row.type === "bump" ? 0 : (durationDays ?? row.durationDays),
  })
  return promotionPriceSchema.parse(row)
})

route("GET", "/admin/promotions", (c) => {
  admin(c)
  const status = c.query.get("status")
  const rows = db.promotions
    .map(promotionView)
    .filter((p) => !status || p.status === status)
    .sort((a, b) => (b.startsAt ?? "9").localeCompare(a.startsAt ?? "9"))
  return pageOf(myPromotionSchema).parse(
    listPage(c, rows, (p) => p.listing.title)
  )
})
route("POST", "/admin/promotions/grant", async (c) => {
  admin(c)
  const { listingId, type, days } = await c.body(grantInputSchema)
  return myPromotionSchema.parse(
    promotionView(grantPromotion(listingId, type, days))
  )
})
// Ending takes the promotion off its listing at once.
route("POST", "/admin/promotions/:id/end", (c) => {
  admin(c)
  const promotion = find(db.promotions, c.params.id ?? "")
  if (!promotion) throw fail(404, "not_found")
  const listing = find(db.listings, promotion.listingId)
  if (listing)
    listing.promotions = listing.promotions.filter(
      (p) => !(p.type === promotion.type && p.startsAt === promotion.startsAt)
    )
  promotion.status = "ended"
  return myPromotionSchema.parse(promotionView(promotion))
})

// Matching accounts that keep announcements on, so the estimate is the number of bells that ring.
// Individuals use their profile city; businesses use the business city. Verified only leaves individuals out.
const audience = (a: BroadcastAudience) =>
  db.users.filter((u) => {
    if (u.banned || u.role === "admin" || !u.prefs.announcements) return false
    if (!a.roles.includes(u.role)) return false
    const business = businessOf(u)?.row
    if (a.verifiedOnly && !business?.verified) return false
    return !a.cityId || (business?.cityId ?? u.cityId) === a.cityId
  })
route(
  "GET",
  "/admin/broadcasts",
  (c) => (
    admin(c),
    pageOf(broadcastSchema).parse(
      listPage(c, [...db.broadcasts].sort(byNewest), (b) => textOf(b.title))
    )
  )
)
route("GET", "/admin/broadcasts/estimate", (c) => {
  admin(c)
  const audienceQuery = broadcastEstimateQuerySchema.safeParse(
    queryObject(c.query, ["roles"])
  )
  if (!audienceQuery.success)
    throw fail(422, "validation", zodFields(audienceQuery.error))
  return estimateSchema.parse({ count: audience(audienceQuery.data).length })
})
// The real API queues the broadcast and a job rings the bells in chunks (api A10, `broadcast-fanout`).
// The mock does it a moment after Send, so the screen goes from "queued" to "sent" as it would.
const FANOUT_DELAY_MS = 1500
function ringBells(id: string, input: z.output<typeof broadcastInputSchema>) {
  const row = find(db.broadcasts, id)
  // A reset in between replaced the whole database.
  if (!row) return
  const users = audience(input)
  for (const u of users)
    notify(u.id, "broadcast", input.title, input.body, input.href)
  row.recipients = users.length
  row.status = "sent"
}
route("POST", "/admin/broadcasts", async (c) => {
  admin(c)
  const input = await c.body(broadcastInputSchema)
  const row = insert(db.broadcasts, {
    id: newId("bc"),
    ...input,
    status: "queued",
    recipients: 0,
    createdAt: nowIso(),
  })
  setTimeout(() => ringBells(row.id, input), FANOUT_DELAY_MS)
  return broadcastSchema.parse(row)
})
