import { beforeEach, describe, expect, test } from "bun:test"
import { adminPlanSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { user } from "~/modules/auth/auth.tables"
import { settings } from "~/modules/content/content.tables"
import { plans, subscriptions } from "~/modules/plans/plans.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

// Seed: plan-dealer-pro has nobody; plan-dealer-growth is held by u-dealer; plan-user-free is the
// individuals' free plan (limit 3 from the settings); plan-dealer-starter the dealers' free plan.
const gold = {
  audience: "dealership",
  name: { ar: "ذهبية", en: "Gold" },
  price: 900000,
  durationDays: 90,
  listingLimit: 500,
  serviceLimit: null,
  photoLimit: null,
  portfolioLimit: null,
  featuredCredits: 3,
  features: [{ ar: "ميزة", en: "Feature" }],
  enabled: true,
  sortOrder: 50,
}

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const create = (body: unknown) => call("POST", "/admin/plans", body)
const edit = (id: string, body: unknown) =>
  call("PATCH", `/admin/plans/${id}`, body)
const remove = (id: string) => call("DELETE", `/admin/plans/${id}`)
const planRow = (id: string) =>
  db
    .select()
    .from(plans)
    .where(eq(plans.id, id))
    .then(([row]) => row)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))

describe("POST /admin/plans", () => {
  test("adds a plan with its caps and writes the audit row", async () => {
    const res = await create(gold)
    expect(res.status).toBe(200)
    const made = await expectSchema(res, adminPlanSchema)
    expect(made).toMatchObject({
      name: { en: "Gold" },
      listingLimit: 500,
      free: false,
      inUse: false,
      subscribers: 0,
    })
    expect(made.serviceLimit).toBeUndefined()
    expect(await auditOf(made.id)).toMatchObject([
      { action: "plan.create", targetType: "plan", adminId: "u-admin" },
    ])
  })

  test("answers 422 for a bad plan", async () => {
    for (const body of [
      {},
      { ...gold, price: -1 },
      { ...gold, name: { ar: "", en: "x" } },
    ])
      expect((await create(body)).status).toBe(422)
  })

  test("the individuals' free plan shows the free-listing setting", async () => {
    await create({ ...gold, audience: "user", price: 0, sortOrder: 0 })
    expect((await planRow("plan-user-free"))?.listingLimit).toBe(3)
  })
})

describe("PATCH /admin/plans/:id", () => {
  test("changes the fields sent, takes a cap off with null, and writes before and after", async () => {
    const res = await edit("plan-dealer-pro", {
      price: 800000,
      listingLimit: null,
      enabled: false,
    })
    expect(res.status).toBe(200)
    const row = await expectSchema(res, adminPlanSchema)
    expect(row).toMatchObject({ price: 800000, enabled: false })
    expect(row.listingLimit).toBeUndefined()
    expect(await auditOf("plan-dealer-pro")).toMatchObject([
      {
        action: "plan.update",
        before: { price: 700000, listingLimit: 300, enabled: true },
        after: { price: 800000, listingLimit: null, enabled: false },
      },
    ])
  })

  test("the audience never changes; an empty edit changes nothing", async () => {
    await edit("plan-dealer-pro", { audience: "user", price: 1 })
    expect((await planRow("plan-dealer-pro"))?.audience).toBe("dealership")
    expect((await edit("plan-dealer-pro", {})).status).toBe(200)
  })

  test("the free plan keeps its price and stays on (409 `in_use`)", async () => {
    for (const body of [{ price: 5 }, { enabled: false }]) {
      const res = await edit("plan-dealer-starter", body)
      expect(res.status).toBe(409)
      expect((await errorOf(res)).code).toBe("in_use")
    }
    expect(
      (
        await edit("plan-dealer-starter", {
          price: 0,
          name: { ar: "ب", en: "B" },
        })
      ).status
    ).toBe(200)
  })

  test("a limit given to the individuals' free plan reads as the setting", async () => {
    const row = await expectSchema(
      await edit("plan-user-free", { listingLimit: 9 }),
      adminPlanSchema
    )
    expect(row.listingLimit).toBe(3)
    await db.update(settings).set({ freeListingLimit: 6 })
    expect(
      (await expectSchema(await edit("plan-user-free", {}), adminPlanSchema))
        .listingLimit
    ).toBe(6)
  })

  test("a running subscription keeps the price it started with", async () => {
    await edit("plan-dealer-growth", { price: 1 })
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, "u-dealer"))
    expect(sub?.price).toBe(350000)
  })

  test("answers 404 for an unknown plan and 422 for a bad edit", async () => {
    expect((await edit("nope", { price: 1 })).status).toBe(404)
    expect((await edit("plan-dealer-pro", { price: -5 })).status).toBe(422)
  })
})

describe("DELETE /admin/plans/:id", () => {
  test("deletes a plan nobody holds and writes the audit row", async () => {
    expect((await remove("plan-dealer-pro")).status).toBe(200)
    expect(await planRow("plan-dealer-pro")).toBeUndefined()
    expect(await auditOf("plan-dealer-pro")).toMatchObject([
      { action: "plan.delete", before: { id: "plan-dealer-pro" } },
    ])
  })

  test("is refused (409 `in_use`) for a held plan, a plan with a receipt and a free plan", async () => {
    // plan-mechanic-plus is named by a receipt only.
    for (const id of [
      "plan-dealer-growth",
      "plan-mechanic-plus",
      "plan-user-free",
    ]) {
      const res = await remove(id)
      expect(res.status).toBe(409)
      expect((await errorOf(res)).code).toBe("in_use")
      expect(await planRow(id)).toBeDefined()
    }
  })

  test("answers 404 for an unknown plan; whoever picked the plan keeps the free one", async () => {
    expect((await remove("nope")).status).toBe(404)
    await db
      .update(user)
      .set({ chosenPlanId: "plan-dealer-pro" })
      .where(eq(user.id, "u-omar"))
    expect((await remove("plan-dealer-pro")).status).toBe(200)
    const [omar] = await db
      .select({ chosen: user.chosenPlanId })
      .from(user)
      .where(eq(user.id, "u-omar"))
    expect(omar?.chosen).toBeNull()
  })
})
