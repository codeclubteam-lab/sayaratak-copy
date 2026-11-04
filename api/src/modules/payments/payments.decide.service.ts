import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { both } from "~/shared/text/bilingual"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import * as ads from "~/modules/ads/ads.service"
import * as auth from "~/modules/auth/auth.service"
import { notify } from "~/modules/notifications/notifications.service"
import * as plans from "~/modules/plans/plans.service"
import * as promotions from "~/modules/promotions/promotions.service"

import * as q from "./payments.admin.queries"
import type { PaymentRow } from "./payments.admin.queries"

/**
 * Approves a receipt and starts what it paid for, in one transaction: the
 * plan from now for its days, the promotion from now for its days (a bump
 * moves the listing to the top at once), or the campaign (approved). The
 * payer is told. Only a payment under review can be decided: 404 for an
 * unknown one, 409 `exists` for one already decided. The row is locked, so
 * two admins pressing Approve together start the plan once.
 */
export async function approvePayment(
  tx: Transaction,
  actor: Actor,
  id: string
) {
  const row = await lockUndecided(tx, id)
  await start(tx, row)
  const saved = await decide(tx, { actor, row, status: "approved" })
  await notify(tx, {
    userId: row.userId ?? "",
    type: "payment_approved",
    title: { ar: "تمت الموافقة على الدفع", en: "Payment approved" },
    body: row.itemLabel,
    href: "/billing",
  })
  return saved
}

/**
 * Rejects a receipt with a reason and tells the payer. A refused plan comes
 * back as the one the payer still has to pay for; a refused campaign goes back
 * to unpaid and frees its slots. 404 and 409 as for an approval.
 */
export async function rejectPayment(
  tx: Transaction,
  actor: Actor,
  change: { id: string; reason: string }
) {
  const row = await lockUndecided(tx, change.id)
  await sendBack(tx, { row, reason: change.reason })
  const saved = await decide(tx, {
    actor,
    row,
    status: "rejected",
    reason: change.reason,
  })
  await notify(tx, {
    userId: row.userId ?? "",
    type: "payment_rejected",
    title: { ar: "تم رفض الدفع", en: "Payment rejected" },
    body: both(change.reason),
    href: "/billing",
  })
  return saved
}

/**
 * The admin decided a campaign on the ads page: the receipt sent for it closes the same way
 * (approved, or rejected with the reason), so the payments page does not offer it again. A
 * campaign with no receipt waiting is left alone.
 */
export async function decideCampaignReceipt(
  tx: Transaction,
  actor: Actor,
  change: {
    campaignId: string
    status: "approved" | "rejected"
    reason?: string
  }
) {
  const row = await q.lockUndecidedOfItem(tx, {
    itemType: "campaign",
    itemId: change.campaignId,
  })
  if (!row) return
  await decide(tx, {
    actor,
    row,
    status: change.status,
    reason: change.reason,
  })
}

async function lockUndecided(tx: Transaction, id: string) {
  const row = await q.lockPayment(tx, id)
  if (!row) fail.notFound()
  // A payment whose payer is gone was rejected with the account, so none under review lacks one.
  if (row.status !== "pending_review" || !row.userId) fail.conflict("exists")
  return { ...row, userId: row.userId }
}

async function start(tx: Transaction, row: PaymentRow & { userId: string }) {
  if (row.itemType === "campaign") return ads.approveCampaign(tx, row.itemId)
  if (row.itemType === "promotion")
    return promotions.startPaidPromotion(tx, {
      id: row.itemId,
      paymentId: row.id,
    })
  const plan = await plans.getPlan(tx, row.itemId)
  if (!plan) fail.notFound()
  await plans.startSubscription(tx, {
    userId: row.userId,
    plan,
    price: plan.price,
    listingLimit: plan.listingLimit,
    durationDays: plan.durationDays,
  })
}

async function sendBack(
  tx: Transaction,
  back: { row: PaymentRow & { userId: string }; reason: string }
) {
  const { row } = back
  if (row.itemType === "campaign")
    await ads.sendCampaignBack(tx, { id: row.itemId, reason: back.reason })
  if (row.itemType === "plan")
    await auth.setChosenPlan(tx, { id: row.userId, planId: row.itemId })
}

async function decide(
  tx: Transaction,
  decision: {
    actor: Actor
    row: PaymentRow
    status: "approved" | "rejected"
    reason?: string
  }
) {
  const { actor, row, status, reason } = decision
  const set = {
    status,
    rejectionReason: reason ?? null,
    reviewedAt: clock.now(),
    reviewedBy: actor.admin.id,
  }
  await q.updateDecision(tx, { id: row.id, set })
  await recordAudit(tx, actor, {
    action: status === "approved" ? "payment.approve" : "payment.reject",
    targetType: "payment",
    targetId: row.id,
    before: { status: row.status },
    after: { status },
    reason,
  })
  return { ...row, ...set }
}
