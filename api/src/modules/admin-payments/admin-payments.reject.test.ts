import { beforeEach, describe, expect, test } from "bun:test"
import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { campaigns } from "~/modules/ads/ads.tables"
import { user } from "~/modules/auth/auth.tables"

import { adminCaller } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"
import {
  auditOf,
  campaignReceipt,
  noticesTo,
  promotionOf,
  rowOf,
} from "./admin-payments.test-helpers"

// Seed: pay-1 is u-omar's Plus receipt, pay-5 the dealer's Featured (promo-54), pay-6 is approved.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const reject = (id: string, body: unknown = { reason: "Blurry" }) =>
  call("POST", `/admin/payments/${id}/reject`, body)

describe("POST /admin/payments/:id/reject", () => {
  test("stores the reason, brings the plan back and tells the payer", async () => {
    const res = await reject("pay-1")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, paymentSchema)).toMatchObject({
      status: "rejected",
      rejectionReason: "Blurry",
    })
    expect(await rowOf("pay-1")).toMatchObject({
      status: "rejected",
      reviewedBy: "u-admin",
    })
    const [omar] = await db
      .select({ chosenPlanId: user.chosenPlanId })
      .from(user)
      .where(eq(user.id, "u-omar"))
    expect(omar?.chosenPlanId).toBe("plan-user-plus")
    const notices = await noticesTo("u-omar", "payment_rejected")
    expect(notices.at(-1)).toMatchObject({
      title: { ar: "تم رفض الدفع", en: "Payment rejected" },
      body: { ar: "Blurry", en: "Blurry" },
      href: "/account/billing",
    })
    expect(await auditOf("pay-1")).toMatchObject([
      { action: "payment.reject", reason: "Blurry" },
    ])
  })

  test("a refused promotion stays unpaid; a refused campaign is unpaid again with the reason", async () => {
    expect((await reject("pay-5")).status).toBe(200)
    expect((await promotionOf("promo-54"))?.status).toBe("pending_payment")
    const id = await campaignReceipt()
    expect((await reject(id, { reason: "No transfer" })).status).toBe(200)
    const [campaign] = await db
      .select({ status: campaigns.status, reason: campaigns.rejectionReason })
      .from(campaigns)
      .where(eq(campaigns.id, "camp-2"))
    expect(campaign).toEqual({
      status: "pending_payment",
      reason: "No transfer",
    })
  })

  test("needs a reason and a payment under review", async () => {
    expect((await reject("pay-1", {})).status).toBe(422)
    expect((await reject("pay-1", { reason: " " })).status).toBe(422)
    expect((await reject("pay-6")).status).toBe(409)
    expect((await reject("nope")).status).toBe(404)
    expect((await rowOf("pay-1"))?.status).toBe("pending_review")
  })
})
