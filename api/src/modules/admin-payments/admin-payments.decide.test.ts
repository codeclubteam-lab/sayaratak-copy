import { beforeEach, describe, expect, test } from "bun:test"
import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { campaigns } from "~/modules/ads/ads.tables"
import { listings } from "~/modules/listings/listings.tables"
import { payments } from "~/modules/payments/payments.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"
import {
  activeOf,
  auditOf,
  campaignReceipt,
  noticesTo,
  promotionOf,
  rowOf,
} from "./admin-payments.test-helpers"

// Seed: pay-1 is u-omar's Plus receipt, pay-2 the dealer's Growth, pay-3 u-omar's bump (promo-53 on
// l0000a), pay-4 the mechanic's Plus (u-mechanic is on Basic), pay-5 the dealer's 7-day Featured
// (promo-54 on l00008); pay-6 is approved and pay-12 rejected. camp-2 is under review.
const DAY_MS = 86_400_000

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const approve = (id: string) => call("POST", `/admin/payments/${id}/approve`)

describe("POST /admin/payments/:id/approve", () => {
  test("starts the plan, tells the payer and writes the audit row", async () => {
    const before = (await noticesTo("u-mechanic", "payment_approved")).length
    const res = await approve("pay-4")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, paymentSchema)).toMatchObject({
      id: "pay-4",
      status: "approved",
    })
    const row = await rowOf("pay-4")
    expect(row).toMatchObject({ status: "approved", reviewedBy: "u-admin" })
    expect(row?.reviewedAt).not.toBeNull()
    const [sub, ...others] = await activeOf("u-mechanic")
    expect(others).toHaveLength(0)
    expect(sub).toMatchObject({ planId: "plan-mechanic-plus", price: 60000 })
    const days =
      ((sub?.endsAt.getTime() ?? 0) - (sub?.startsAt.getTime() ?? 0)) / DAY_MS
    expect(days).toBe(30)
    const notices = await noticesTo("u-mechanic", "payment_approved")
    expect(notices).toHaveLength(before + 1)
    expect(notices.at(-1)).toMatchObject({
      title: { ar: "تمت الموافقة على الدفع", en: "Payment approved" },
      href: "/mechanic/billing",
    })
    expect(await auditOf("pay-4")).toMatchObject([
      {
        action: "payment.approve",
        targetType: "payment",
        adminId: "u-admin",
        before: { status: "pending_review" },
        after: { status: "approved" },
      },
    ])
  })

  test("a Featured payment starts the promotion for its days", async () => {
    expect((await approve("pay-5")).status).toBe(200)
    const promo = await promotionOf("promo-54")
    expect(promo).toMatchObject({ status: "active", paymentId: "pay-5" })
    const days =
      ((promo?.endsAt?.getTime() ?? 0) - (promo?.startsAt?.getTime() ?? 0)) /
      DAY_MS
    expect(days).toBe(7)
  })

  test("a bump payment ends at once and moves the listing to the top", async () => {
    expect((await approve("pay-3")).status).toBe(200)
    const promo = await promotionOf("promo-53")
    expect(promo?.status).toBe("ended")
    expect(promo?.endsAt?.getTime()).toBe(promo?.startsAt?.getTime() ?? -1)
    const [listing] = await db
      .select({ bumpedAt: listings.bumpedAt })
      .from(listings)
      .where(eq(listings.id, "l0000a"))
    expect(listing?.bumpedAt?.getTime()).toBe(promo?.startsAt?.getTime() ?? -1)
  })

  test("a campaign payment approves the campaign", async () => {
    const id = await campaignReceipt()
    expect((await approve(id)).status).toBe(200)
    const [campaign] = await db
      .select({ status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, "camp-2"))
    expect(campaign?.status).toBe("approved")
  })

  test("only a payment under review: 409 `exists`, 404 for an unknown one", async () => {
    for (const id of ["pay-6", "pay-12"]) {
      const res = await approve(id)
      expect(res.status).toBe(409)
      expect((await errorOf(res)).code).toBe("exists")
    }
    expect((await approve("nope")).status).toBe(404)
    expect(await auditOf("pay-6")).toHaveLength(0)
    expect((await activeOf("u-workshop")).map((s) => s.planId)).toEqual([
      "plan-workshop-plus",
    ])
  })

  test("a receipt for a plan that is gone changes nothing", async () => {
    await db
      .update(payments)
      .set({ itemId: "gone" })
      .where(eq(payments.id, "pay-4"))
    expect((await approve("pay-4")).status).toBe(404)
    expect((await rowOf("pay-4"))?.status).toBe("pending_review")
    expect(await auditOf("pay-4")).toHaveLength(0)
  })

  test("two admins approving together start the plan once", async () => {
    const other = adminCaller()
    const before = (await noticesTo("u-dealer", "payment_approved")).length
    const both = await Promise.all([
      approve("pay-2"),
      other("POST", "/admin/payments/pay-2/approve"),
    ])
    expect(both.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await activeOf("u-dealer")).toHaveLength(1)
    expect(await noticesTo("u-dealer", "payment_approved")).toHaveLength(
      before + 1
    )
    expect(await auditOf("pay-2")).toHaveLength(1)
  })
})
