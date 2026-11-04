import { afterAll, beforeAll, describe, test } from "bun:test"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

// One admin sign-in for the whole file: the emailed code is capped per address.
let headers: Record<string, string> = {}

beforeAll(async () => {
  await resetDb()
  headers = {
    ...(await bothSessions("admin")),
    origin: "http://localhost:3000",
    "content-type": "application/json",
  }
})

// The mock's rows live for the whole run, so what the writes below change is put back.
afterAll(async () => {
  const { handleMock } = await import("../../../../web/src/mocks/router")
  await handleMock(
    new Request("http://localhost/api/mock/reset", { method: "POST" })
  )
  await resetDb()
})

// A plan made here gets a random id on each side.
const sameIds = (body: unknown) =>
  JSON.parse(
    JSON.stringify(body).replace(/"plan-[A-Za-z0-9_-]{8}"/g, '"plan-new"')
  )

const read = (path: string) =>
  expectParity(path, { init: { headers }, ignore: sameIds })
const write = (
  method: string,
  path: string,
  options: { body?: unknown; ignore?: (body: unknown) => unknown } = {}
) =>
  expectParity(path, {
    ignore: options.ignore ?? sameIds,
    init: {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    },
  })

// Both sides draw a random id for a new plan.
const withoutId = (body: unknown) => {
  const { id: _, ...rest } = body as Record<string, unknown>
  return rest
}

describe("GET /admin/plans and /admin/subscriptions match the mock", () => {
  test("the plans", async () => {
    await read("/api/v1/admin/plans")
  })

  test("the subscriptions with each filter", async () => {
    for (const query of [
      "",
      "?pageSize=2&page=2",
      "?audience=dealership",
      "?audience=user",
      "?audience=nope",
      "?planId=plan-workshop-plus",
      "?status=active",
      "?status=expired",
      "?q=omar",
      "?q=zzzz",
    ])
      await read(`/api/v1/admin/subscriptions${query}`)
  })
})

describe("the plan writes match the mock", () => {
  const plan = {
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

  test("create and read back", async () => {
    await write("POST", "/api/v1/admin/plans", {
      body: plan,
      ignore: withoutId,
    })
    await write("POST", "/api/v1/admin/plans", { body: { ...plan, price: -1 } })
    await write("POST", "/api/v1/admin/plans", { body: { audience: "user" } })
  })

  test("edit: caps, the free plan and unknown plans", async () => {
    const path = (id: string) => `/api/v1/admin/plans/${id}`
    await write("PATCH", path("plan-dealer-pro"), {
      body: {
        price: 800000,
        listingLimit: null,
        enabled: false,
        sortOrder: 40,
      },
    })
    await write("PATCH", path("plan-user-free"), { body: { listingLimit: 9 } })
    await write("PATCH", path("plan-user-free"), { body: { price: 1 } })
    await write("PATCH", path("plan-user-free"), { body: { enabled: false } })
    await write("PATCH", path("plan-mechanic-basic"), {
      body: { name: { ar: "أساسية", en: "Basic!" }, featuredCredits: 2 },
    })
    await write("PATCH", path("plan-dealer-growth"), { body: {} })
    await write("PATCH", path("nope"), { body: { price: 1 } })
    await write("PATCH", path("plan-dealer-pro"), { body: { price: -5 } })
    await write("PATCH", path("plan-dealer-pro"), {
      body: { audience: "user" },
    })
    await read("/api/v1/admin/plans")
  })

  test("delete: in use, free, unknown, free to go", async () => {
    const path = (id: string) => `/api/v1/admin/plans/${id}`
    await write("DELETE", path("plan-dealer-growth"))
    await write("DELETE", path("plan-user-free"))
    await write("DELETE", path("nope"))
    await write("DELETE", path("plan-dealer-pro"))
    await read("/api/v1/admin/plans")
  })
})
