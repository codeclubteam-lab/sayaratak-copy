import { beforeEach, describe, expect, test } from "bun:test"
import {
  adminPlanSchema,
  adminSubscriptionSchema,
} from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()

// Seed: nine plans; four active subscriptions (u-omar Plus, u-dealer Growth, u-workshop Plus,
// u-mechanic Basic); receipts name the user Plus, dealer Growth and the workshop and mechanic Plus.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const plansTable = async () => {
  const res = await call("GET", "/admin/plans")
  expect(res.status).toBe(200)
  return expectSchema(res, z.array(adminPlanSchema))
}
const subscriptions = async (query = "") => {
  const res = await call("GET", `/admin/subscriptions${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(adminSubscriptionSchema))
}
const idsOf = async (query: string) =>
  (await subscriptions(query)).items.map((item) => item.id).sort()

describe("admin plan routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/plans"],
      ["POST", "/admin/plans"],
      ["PATCH", "/admin/plans/plan-dealer-pro"],
      ["DELETE", "/admin/plans/plan-dealer-pro"],
      ["GET", "/admin/subscriptions"],
    ] as const) {
      expect((await req(path, { method })).status).toBe(401)
      const seller = await req(path, {
        method,
        headers: { cookie, origin, "content-type": "application/json" },
        body: method === "GET" || method === "DELETE" ? undefined : "{}",
      })
      expect(seller.status).toBe(403)
    }
  })
})

describe("GET /admin/plans", () => {
  test("is every plan in list order with its flags", async () => {
    const rows = await plansTable()
    expect(rows.map((row) => row.id)).toEqual(seeded.plans.map((p) => p.id))
    expect(rows.filter((row) => row.free).map((row) => row.id)).toEqual([
      "plan-user-free",
      "plan-dealer-starter",
      "plan-workshop-basic",
      "plan-mechanic-basic",
    ])
  })

  test("says which plans are in use and how many hold them now", async () => {
    const byId = new Map((await plansTable()).map((row) => [row.id, row]))
    expect(byId.get("plan-dealer-growth")).toMatchObject({
      inUse: true,
      subscribers: 1,
    })
    // Only a receipt names the user Plus... and a subscription does too.
    expect(byId.get("plan-user-plus")).toMatchObject({ inUse: true })
    expect(byId.get("plan-dealer-pro")).toMatchObject({
      inUse: false,
      subscribers: 0,
    })
  })
})

describe("GET /admin/subscriptions", () => {
  test("is every subscription with its plan and holder", async () => {
    const page = await subscriptions()
    expect(page).toMatchObject({ total: 4, page: 1, pageSize: 20 })
    const dealer = page.items.find((item) => item.userId === "u-dealer")
    expect(dealer).toMatchObject({
      planId: "plan-dealer-growth",
      status: "active",
      plan: { audience: "dealership" },
      subscriber: { businessId: "d-1" },
    })
    expect(dealer?.usage.used).toBeGreaterThan(0)
    expect(dealer?.usage.limit).toBe(80)
    // A person with no business is named in both languages.
    const person = page.items.find((item) => item.userId === "u-omar")
    expect(person?.subscriber.businessId).toBeUndefined()
    expect(person?.subscriber.name).toEqual({
      ar: "Omar Hassan",
      en: "Omar Hassan",
    })
  })

  test("filters by audience, plan, status and holder", async () => {
    expect((await idsOf("?audience=dealership")).length).toBe(1)
    expect((await idsOf("?audience=nope")).length).toBe(0)
    expect((await idsOf("?planId=plan-workshop-plus")).length).toBe(1)
    expect((await idsOf("?status=active")).length).toBe(4)
    expect((await idsOf("?status=expired")).length).toBe(0)
    expect((await idsOf("?q=OMAR")).length).toBe(1)
    const business = seeded.dealerships[0]?.name
    for (const text of [business?.ar, business?.en])
      expect(await idsOf(`?q=${encodeURIComponent(text ?? "")}`)).toHaveLength(
        1
      )
    expect((await idsOf("?q=zzzz")).length).toBe(0)
  })

  test("a business owner's own name does not find the subscription", async () => {
    await db
      .update(user)
      .set({ name: "Zed Hamdan" })
      .where(eq(user.id, "u-dealer"))
    expect(await idsOf("?q=zed")).toEqual([])
    expect(await idsOf("?q=nasr")).toHaveLength(1)
  })
})
