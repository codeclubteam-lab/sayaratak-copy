import { beforeEach, describe, expect, test } from "bun:test"
import { adminBusinessSchema } from "@sayaratak/shared/schemas/admin"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { subscriptions } from "~/modules/plans/plans.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

// Seed: d-1 is the dealership of u-dealer (Growth plan, 80 listings), d-2 one of ud-1 with no
// subscription, m-1 the mechanic of u-mechanic (Basic).
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const assign = (id: string, body: unknown) =>
  call("POST", `/admin/businesses/${id}/assign-plan`, body)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
const noticesTo = (userId: string) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "business_status")
      )
    )
const activeOf = (userId: string) =>
  db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )

describe("POST /admin/businesses/:id/assign-plan", () => {
  test("replaces the subscription with the plan's own values and tells the owner", async () => {
    const res = await assign("d-1", { planId: "plan-dealer-pro" })
    expect(res.status).toBe(200)
    const row = await expectSchema(res, adminBusinessSchema)
    expect(row.plan).toMatchObject({
      id: "plan-dealer-pro",
      price: 700000,
      limit: 300,
    })
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, "u-dealer"))
    expect(subs.filter((s) => s.status === "active")).toHaveLength(1)
    expect(subs.find((s) => s.planId === "plan-dealer-growth")?.status).toBe(
      "canceled"
    )
    const notice = (await noticesTo("u-dealer")).find((n) =>
      n.title.en.includes("plan changed")
    )
    expect(notice).toMatchObject({
      title: { ar: "تغيّرت باقتك", en: "Your plan changed" },
      body: { en: "You are now on Pro." },
      href: "/dealer/billing",
    })
    expect(await auditOf("d-1")).toMatchObject([
      {
        action: "business.assign_plan",
        before: { planId: "plan-dealer-growth" },
        after: { planId: "plan-dealer-pro", price: 700000, listingLimit: 300 },
      },
    ])
  })

  test("takes a custom price, limit, length and note", async () => {
    const res = await assign("d-2", {
      planId: "plan-dealer-growth",
      price: 1000,
      limit: 5,
      durationDays: 10,
      note: "Gift",
    })
    const row = await expectSchema(res, adminBusinessSchema)
    expect(row.plan).toMatchObject({ price: 1000, limit: 5, note: "Gift" })
    const days = (Date.parse(row.plan.endsAt ?? "") - Date.now()) / 86_400_000
    expect(Math.round(days)).toBe(10)
    // null takes the cap off.
    const open = await assign("d-2", { planId: "plan-dealer-pro", limit: null })
    expect(
      (await expectSchema(open, adminBusinessSchema)).plan.limit
    ).toBeNull()
  })

  test("a workshop or mechanic has no listing limit", async () => {
    const row = await expectSchema(
      await assign("m-1", { planId: "plan-mechanic-plus", limit: 9 }),
      adminBusinessSchema
    )
    expect(row.plan).toMatchObject({ id: "plan-mechanic-plus", limit: null })
  })

  test("answers 404 for an unknown business or plan, 422 for another audience", async () => {
    expect((await assign("nope", { planId: "plan-dealer-pro" })).status).toBe(
      404
    )
    expect((await assign("d-1", { planId: "nope" })).status).toBe(404)
    const wrong = await assign("d-1", { planId: "plan-workshop-plus" })
    expect(wrong.status).toBe(422)
    expect((await errorOf(wrong)).fields).toEqual({
      planId: "validation.required",
    })
    expect(
      (await assign("d-1", { planId: "plan-dealer-pro", price: -1 })).status
    ).toBe(422)
    // Nothing moved.
    expect((await activeOf("u-dealer")).map((s) => s.planId)).toEqual([
      "plan-dealer-growth",
    ])
  })

  test("two admins assigning together leave one active subscription", async () => {
    const other = adminCaller()
    const both = await Promise.all([
      assign("d-2", { planId: "plan-dealer-growth" }),
      other("POST", "/admin/businesses/d-2/assign-plan", {
        planId: "plan-dealer-pro",
      }),
    ])
    expect(both.map((r) => r.status)).toEqual([200, 200])
    expect(await activeOf("ud-1")).toHaveLength(1)
  })
})
