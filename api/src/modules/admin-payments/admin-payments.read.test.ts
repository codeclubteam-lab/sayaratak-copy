import { beforeEach, describe, expect, test } from "bun:test"
import { adminPaymentsPageSchema } from "@sayaratak/shared/schemas/responses"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()
const pending = seeded.payments.filter((p) => p.status === "pending_review")

// Seed: pay-1 to pay-5 wait for review (pay-3 is a bump of promo-53, pay-5 a 7-day Featured of
// promo-54), pay-6 to pay-11 are approved and pay-12 and pay-13 rejected.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const table = async (query = "") => {
  const res = await call("GET", `/admin/payments${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, adminPaymentsPageSchema)
}
const idsOf = async (query: string) =>
  (await table(query)).items.map((item) => item.id).sort()

describe("admin payment routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/payments"],
      ["POST", "/admin/payments/pay-1/approve"],
      ["POST", "/admin/payments/pay-1/reject"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/payments", () => {
  test("is every payment newest first with the payer's name", async () => {
    const page = await table()
    expect(page).toMatchObject({
      total: seeded.payments.length,
      page: 1,
      pageSize: 20,
    })
    const times = page.items.map((item) => item.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    const [omar] = (await table("?id=pay-1")).items
    expect(omar).toMatchObject({
      userId: "u-omar",
      user: { id: "u-omar", name: "Omar Hassan" },
      status: "pending_review",
      receiptUrl: expect.any(String),
    })
  })

  test("the strip holds the money approved this month and what waits", async () => {
    const { summary } = await table()
    expect(summary.pendingCount).toBe(pending.length)
    expect(summary.pendingAmount).toBe(
      pending.reduce((sum, p) => sum + p.amount, 0)
    )
    const month = new Date().toISOString().slice(0, 7)
    const approved = seeded.payments
      .filter(
        (p) =>
          p.status === "approved" &&
          (p.reviewedAt ?? p.createdAt).startsWith(month)
      )
      .reduce((sum, p) => sum + p.amount, 0)
    // Close to a month change the Khartoum month can differ from the UTC one.
    if (new Date().getUTCDate() > 1)
      expect(summary.approvedThisMonth).toBe(approved)
  })

  test("filters by status, payer, id and text", async () => {
    expect(await idsOf("?status=pending_review")).toEqual(
      pending.map((p) => p.id).sort()
    )
    expect(await idsOf("?status=nope")).toEqual([])
    expect(await idsOf("?userId=u-dealer&pageSize=50")).toEqual(
      seeded.payments
        .filter((p) => p.userId === "u-dealer")
        .map((p) => p.id)
        .sort()
    )
    expect(await idsOf("?id=pay-4")).toEqual(["pay-4"])
    const [pay2] = (await table("?id=pay-2")).items
    for (const text of [
      pay2?.reference,
      pay2?.transactionRef,
      pay2?.itemLabel.ar,
      pay2?.itemLabel.en?.toUpperCase(),
    ])
      expect(await idsOf(`?q=${encodeURIComponent(text ?? "")}`)).toContain(
        "pay-2"
      )
    expect(await idsOf("?q=zzzz")).toEqual([])
  })

  test("says what approval starts: days of a plan, a promotion and its listing", async () => {
    const plan = (await table("?id=pay-4")).items[0]
    const planDays = seeded.plans.find((p) => p.id === "plan-mechanic-plus")
    expect(plan?.order).toEqual({ durationDays: planDays?.durationDays ?? 0 })
    const featured = (await table("?id=pay-5")).items[0]
    expect(featured?.order).toMatchObject({
      durationDays: 7,
      promotionType: "featured",
      listing: { slug: expect.any(String), title: expect.any(String) },
    })
    const bump = (await table("?id=pay-3")).items[0]
    expect(bump?.order).toMatchObject({
      durationDays: 0,
      promotionType: "bump",
    })
  })
})
