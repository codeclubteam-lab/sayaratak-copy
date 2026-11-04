import { beforeEach, describe, expect, test } from "bun:test"
import { adminBusinessSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"

import { adminCaller } from "../../../tests/admin"
import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()
const TOTAL =
  seeded.dealerships.length + seeded.workshops.length + seeded.mechanics.length

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const table = async (query = "") => {
  const res = await call("GET", `/admin/businesses${query}`)
  expect(res.status).toBe(200)
  return expectSchema(res, pageOf(adminBusinessSchema))
}
const idsOf = async (query: string) =>
  (await table(`${query}&pageSize=100`)).items.map((item) => item.id).sort()

describe("admin business routes", () => {
  test("answer 401 signed out and 403 `forbidden` to a seller", async () => {
    const { cookie, origin } = await signIn("dealership")
    for (const [method, path] of [
      ["GET", "/admin/businesses"],
      ["PATCH", "/admin/businesses/d-1"],
      ["POST", "/admin/businesses/d-1/assign-plan"],
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

describe("GET /admin/businesses", () => {
  test("is every kind newest first, 20 to a page", async () => {
    const page = await table()
    expect(page).toMatchObject({ total: TOTAL, page: 1, pageSize: 20 })
    expect(page.items).toHaveLength(20)
    const times = page.items.map((item) => item.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect((await table("?page=3")).items).toHaveLength(TOTAL - 40)
  })

  test("filters by type, id, city, badge and status", async () => {
    expect((await table("?type=workshop")).total).toBe(seeded.workshops.length)
    expect((await table("?type=nope")).total).toBe(0)
    expect(await idsOf("?id=m-2")).toEqual(["m-2"])
    const khartoum = [
      ...seeded.dealerships,
      ...seeded.workshops,
      ...seeded.mechanics,
    ].filter((b) => b.cityId === "khartoum")
    expect(await idsOf("?cityId=khartoum")).toEqual(
      khartoum.map((b) => b.id).sort()
    )
    const verified = await table("?verified=yes&pageSize=100")
    expect(verified.items.every((item) => item.verified)).toBe(true)
    const unverified = await table("?verified=no&pageSize=100")
    expect(unverified.items.some((item) => item.verified)).toBe(false)
    expect(verified.total + unverified.total).toBe(TOTAL)
    expect(await idsOf("?status=suspended")).toEqual(["d-12"])
    expect((await table("?status=nope")).total).toBe(0)
  })

  test("finds a business by its name in either language or by its owner", async () => {
    const owner = seeded.users.find((u) => u.id === "u-dealer")
    const byOwner = await table(
      `?q=${encodeURIComponent((owner?.fullName ?? "").toUpperCase())}`
    )
    expect(byOwner.items.map((item) => item.id)).toContain("d-1")
    const name = seeded.workshops[1]?.name
    for (const text of [name?.ar, name?.en]) {
      const found = await table(`?q=${encodeURIComponent(text ?? "")}`)
      expect(found.items.map((item) => item.id)).toContain("w-2")
    }
    expect((await table("?q=zzzz")).total).toBe(0)
  })

  test("shows the owner, the plan and, for a dealership, the live listings", async () => {
    const [dealer] = (await table("?id=d-1")).items
    expect(dealer).toMatchObject({
      type: "dealership",
      ownerId: "u-dealer",
      plan: { id: "plan-dealer-growth", price: 350000, limit: 80 },
    })
    expect(dealer?.owner?.email).toBeTruthy()
    expect(dealer?.listings).toBe(dealer?.plan.used)
    expect(dealer?.listings).toBeGreaterThan(0)
    const [workshop] = (await table("?id=w-1")).items
    expect(workshop).toMatchObject({
      listings: null,
      plan: { id: "plan-workshop-plus", used: 0, limit: null },
    })
  })

  test("shows the audience's free plan for a business with no subscription", async () => {
    const [dealer] = (await table("?id=d-2")).items
    expect(dealer?.plan).toMatchObject({
      id: "plan-dealer-starter",
      price: 0,
      endsAt: null,
      limit: null,
    })
  })

  test("filters by the plan a business shows, the free one included", async () => {
    expect(await idsOf("?planId=plan-dealer-growth")).toEqual(["d-1"])
    expect(await idsOf("?planId=plan-workshop-plus")).toEqual(["w-1"])
    const free = await idsOf("?planId=plan-dealer-starter")
    expect(free).toHaveLength(seeded.dealerships.length - 1)
    expect(free).not.toContain("d-1")
    expect((await table("?planId=nope")).total).toBe(0)
  })
})
