import { beforeEach, describe, expect, test } from "bun:test"
import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { checkoutSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { campaigns } from "~/modules/ads/ads.tables"
import { user } from "~/modules/auth/auth.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import { db } from "~/shared/db/client"

import { postPayment, textFile } from "../../../tests/files"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { payments } from "./payments.tables"

// Seed: u-workshop has no receipt waiting and is on plan-workshop-basic's audience; plan-workshop-plus costs 120000.
// camp-2 is u-workshop's banner campaign under review; u-omar has pay-1 (plan-user-plus) waiting.
const plan = {
  itemType: "plan",
  itemId: "plan-workshop-plus",
  payerName: "  Ali Hassan ",
  transactionRef: "TX12345",
}

beforeEach(resetDb)

describe("POST /payments", () => {
  test("queues a receipt at the plan's price, with the reference the checkout shows", async () => {
    const shop = await signIn("workshop")
    const checkout = await expectSchema(
      await req("/checkout?item=plan:plan-workshop-plus", {
        headers: { cookie: shop.cookie },
      }),
      checkoutSchema
    )
    const res = await postPayment(shop, { ...plan, amount: "1" })
    const payment = await expectSchema(res, paymentSchema)
    expect(payment).toMatchObject({
      itemType: "plan",
      itemId: "plan-workshop-plus",
      amount: 120000,
      status: "pending_review",
      payerName: "Ali Hassan",
      reference: checkout.reference,
      method: "bankak_transfer",
    })
    expect(payment.itemLabel).toEqual(checkout.itemLabel)
  })

  test("keeps the receipt private: the payer reads it, nobody else", async () => {
    const shop = await signIn("workshop")
    const payment = await expectSchema(
      await postPayment(shop, plan),
      paymentSchema
    )
    const path = new URL(payment.receiptUrl).pathname.replace("/api/v1", "")
    expect((await req(path, { headers: { cookie: shop.cookie } })).status).toBe(
      200
    )
    const other = await signIn("mechanic")
    expect(
      (await req(path, { headers: { cookie: other.cookie } })).status
    ).toBe(404)
    const [row] = await db
      .select({ delivery: uploads.delivery, kind: uploads.kind })
      .from(uploads)
      .where(eq(uploads.id, path.split("/").at(-1) ?? ""))
    expect(row).toEqual({ delivery: "private", kind: "receipt" })
  })

  test("forgets the plan picked in onboarding", async () => {
    const shop = await signIn("workshop")
    await db
      .update(user)
      .set({ chosenPlanId: "plan-workshop-plus" })
      .where(eq(user.id, "u-workshop"))
    await postPayment(shop, plan)
    const [row] = await db
      .select({ chosen: user.chosenPlanId })
      .from(user)
      .where(eq(user.id, "u-workshop"))
    expect(row?.chosen).toBeNull()
  })

  test("is 409 payment_pending while a receipt for the item waits, and allowed again after a rejection", async () => {
    const shop = await signIn("workshop")
    const first = await expectSchema(
      await postPayment(shop, plan),
      paymentSchema
    )
    const again = await postPayment(shop, plan)
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ code: "payment_pending" })
    await db
      .update(payments)
      .set({ status: "rejected" })
      .where(eq(payments.id, first.id))
    expect((await postPayment(shop, plan)).status).toBe(200)
  })

  test("lets one of two sends made together in, and stores one file", async () => {
    const shop = await signIn("workshop")
    const before = await db.$count(uploads)
    const statuses = (
      await Promise.all([postPayment(shop, plan), postPayment(shop, plan)])
    )
      .map((res) => res.status)
      .sort()
    expect(statuses).toEqual([200, 409])
    expect(await db.$count(uploads)).toBe(before + 1)
  })

  test("puts a campaign back under review and clears its rejection reason", async () => {
    const shop = await signIn("workshop")
    await db
      .update(campaigns)
      .set({ status: "pending_payment", rejectionReason: "blurry" })
      .where(eq(campaigns.id, "camp-2"))
    const res = await postPayment(shop, {
      ...plan,
      itemType: "campaign",
      itemId: "camp-2",
    })
    expect(res.status).toBe(200)
    const [row] = await db
      .select({
        status: campaigns.status,
        reason: campaigns.rejectionReason,
      })
      .from(campaigns)
      .where(eq(campaigns.id, "camp-2"))
    expect(row).toEqual({ status: "under_review", reason: null })
  })

  test("refuses a receipt that is not a picture and stores nothing", async () => {
    const shop = await signIn("workshop")
    const before = await db.$count(payments)
    const res = await postPayment(
      shop,
      plan,
      textFile("<svg onload=alert(1)>", "image/png")
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      fields: { file: "validation.image_type" },
    })
    expect(await db.$count(payments)).toBe(before)
  })

  test("is 401 signed out", async () => {
    const res = await req("/payments", { method: "POST" })
    expect(res.status).toBe(401)
  })
})
