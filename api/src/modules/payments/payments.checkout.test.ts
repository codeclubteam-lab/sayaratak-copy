import { beforeEach, describe, expect, test } from "bun:test"
import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { checkoutSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { plans } from "~/modules/plans/plans.tables"
import { db } from "~/shared/db/client"

import { postPayment } from "../../../tests/files"
import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"

// Seed: u-workshop has no receipt waiting; plan-workshop-plus is theirs to buy; promo-53 is u-omar's.
const plan = {
  itemType: "plan",
  itemId: "plan-workshop-plus",
  payerName: "Ali Hassan",
  transactionRef: "TX12345",
}

beforeEach(resetDb)

describe("GET /me/payments", () => {
  test("lists the payer's payments, newest first, and pages them", async () => {
    const shop = await signIn("workshop")
    const sent = await expectSchema(
      await postPayment(shop, plan),
      paymentSchema
    )
    const page = await expectSchema(
      await req("/me/payments", { headers: { cookie: shop.cookie } }),
      pageOf(paymentSchema)
    )
    expect(page.items[0]?.id).toBe(sent.id)
    expect(page.items.every((p) => p.userId === "u-workshop")).toBe(true)
    const second = await expectSchema(
      await req("/me/payments?page=2&pageSize=1", {
        headers: { cookie: shop.cookie },
      }),
      pageOf(paymentSchema)
    )
    expect(second).toMatchObject({ page: 2, pageSize: 1, total: page.total })
    expect(second.items).toHaveLength(1)
  })
})

describe("GET /checkout", () => {
  test("shows the receipt already waiting for the item", async () => {
    const shop = await signIn("workshop")
    const path = "/checkout?item=plan:plan-workshop-plus"
    const open = await expectSchema(
      await req(path, { headers: { cookie: shop.cookie } }),
      checkoutSchema
    )
    expect(open.pendingPaymentId).toBeNull()
    const sent = await expectSchema(
      await postPayment(shop, plan),
      paymentSchema
    )
    const waiting = await expectSchema(
      await req(path, { headers: { cookie: shop.cookie } }),
      checkoutSchema
    )
    expect(waiting.pendingPaymentId).toBe(sent.id)
    expect(waiting.bankak).toEqual({ name: "Sayaratak", number: "1234567" })
  })

  test("is 404 for a plan of another audience or a plan switched off", async () => {
    const shop = await signIn("workshop")
    const read = (item: string) =>
      req(`/checkout?item=${item}`, { headers: { cookie: shop.cookie } })
    expect((await read("plan:plan-dealer-pro")).status).toBe(404)
    expect((await read("gift:x")).status).toBe(404)
    await db
      .update(plans)
      .set({ enabled: false })
      .where(eq(plans.id, "plan-workshop-plus"))
    expect((await read("plan:plan-workshop-plus")).status).toBe(404)
  })

  test("is 403 for someone else's promotion", async () => {
    const dealer = await signIn("dealership")
    const res = await req("/checkout?item=promotion:promo-53", {
      headers: { cookie: dealer.cookie },
    })
    expect(res.status).toBe(403)
  })
})
