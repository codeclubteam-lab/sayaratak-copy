import { z } from "zod"

import {
  adminCampaignSchema,
  adPageSchema,
} from "@sayaratak/shared/schemas/ads"
import {
  adPagePatchSchema,
  rejectInputSchema,
} from "@sayaratak/shared/schemas/inputs"

import { db, find } from "../db"
import { fail, needRole, route, type Ctx } from "../http"
import { notify, nowIso } from "../lib"
import type { CampaignRow } from "../types"
import { campaignView, freeSlots } from "./ads"

const admin = (c: Ctx) => needRole(c, "admin")
const campaignOf = (id: string) => {
  const row = find(db.campaigns, id)
  if (!row) throw fail(404, "not_found")
  return row
}
const paymentOf = (campaignId: string) =>
  db.payments.find(
    (p) =>
      p.itemType === "campaign" &&
      p.itemId === campaignId &&
      p.status === "pending_review"
  )

// Waiting ones first, then the newest.
route("GET", "/admin/campaigns", (c) => {
  admin(c)
  const rank = (x: CampaignRow) => (x.status === "under_review" ? 0 : 1)
  return z.array(adminCampaignSchema).parse(
    [...db.campaigns]
      .sort(
        (a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)
      )
      .map((x) => ({
        ...campaignView(x),
        receiptUrl:
          db.payments.find(
            (p) => p.itemType === "campaign" && p.itemId === x.id
          )?.receiptUrl ?? null,
      }))
  )
})

// Approval checks the banner and the receipt together: the payment is approved with it.
route("POST", "/admin/campaigns/:id/approve", (c) => {
  admin(c)
  const row = campaignOf(c.params.id ?? "")
  if (row.status !== "under_review") throw fail(409, "exists")
  const payment = paymentOf(row.id)
  if (payment) {
    payment.status = "approved"
    payment.reviewedAt = nowIso()
  }
  row.status = "approved"
  delete row.rejectionReason
  notify(
    row.ownerId,
    "payment_approved",
    { ar: "تمت الموافقة على إعلانك", en: "Your banner campaign is approved" },
    { ar: row.creative.copy.ar.heading, en: row.creative.copy.en.heading },
    "/ads"
  )
  return campaignView(row)
})
route("POST", "/admin/campaigns/:id/reject", async (c) => {
  admin(c)
  const row = campaignOf(c.params.id ?? "")
  const { reason } = await c.body(rejectInputSchema)
  const payment = paymentOf(row.id)
  if (payment) {
    payment.status = "rejected"
    payment.rejectionReason = reason
    payment.reviewedAt = nowIso()
  }
  row.status = "rejected"
  row.rejectionReason = reason
  notify(
    row.ownerId,
    "payment_rejected",
    { ar: "تم رفض إعلانك", en: "Your banner campaign was rejected" },
    { ar: reason, en: reason },
    "/ads"
  )
  return campaignView(row)
})

route("GET", "/admin/ad-pages", (c) => {
  admin(c)
  return z
    .array(adPageSchema)
    .parse(db.adPages.map((p) => ({ ...p, free: freeSlots(p.id) })))
})
route("PATCH", "/admin/ad-pages/:id", async (c) => {
  admin(c)
  const row = find(db.adPages, c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  Object.assign(row, await c.body(adPagePatchSchema))
  return adPageSchema.parse({ ...row, free: freeSlots(row.id) })
})
