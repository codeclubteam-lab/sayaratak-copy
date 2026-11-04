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

// A promotion made here gets a random id on each side.
const sameIds = (body: unknown) =>
  JSON.parse(
    JSON.stringify(body).replace(/"promo-[A-Za-z0-9_-]{8}"/g, '"promo-new"')
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

describe("GET /admin/promotion-prices and /admin/promotions match the mock", () => {
  test("the prices", async () => {
    await read("/api/v1/admin/promotion-prices")
  })

  test("the table with each filter", async () => {
    for (const query of [
      "",
      "?page=2",
      "?pageSize=7&page=3",
      "?status=active&pageSize=50",
      "?status=ended&pageSize=50",
      "?status=pending_payment",
      "?status=nope",
      "?q=toyota",
      "?q=zzzz",
    ])
      await read(`/api/v1/admin/promotions${query}`)
  })
})

describe("the price writes match the mock", () => {
  test("change a price, a length, a bump and refusals", async () => {
    const path = (id: string) => `/api/v1/admin/promotion-prices/${id}`
    await write("PATCH", path("featured-7"), { body: { price: 45000 } })
    await write("PATCH", path("featured-3"), {
      body: { price: 25000, durationDays: 2 },
    })
    await write("PATCH", path("bump"), {
      body: { price: 6000, durationDays: 5 },
    })
    await write("PATCH", path("featured-14"), { body: {} })
    await write("PATCH", path("nope"), { body: { price: 1 } })
    await read("/api/v1/admin/promotion-prices")
  })
})

describe("the promotion writes match the mock", () => {
  test("grant a Featured and a bump", async () => {
    await write("POST", "/api/v1/admin/promotions/grant", {
      body: { listingId: "l00006", type: "featured", days: 5 },
    })
    await write("POST", "/api/v1/admin/promotions/grant", {
      body: { listingId: "l00007", type: "featured" },
    })
    await write("POST", "/api/v1/admin/promotions/grant", {
      body: { listingId: "l00009", type: "bump", days: 9 },
    })
    await write("POST", "/api/v1/admin/promotions/grant", {
      body: { listingId: "nope", type: "featured", days: 3 },
    })
    await write("POST", "/api/v1/admin/promotions/grant", {
      body: { listingId: "l00006", type: "featured", days: 0 },
    })
    await read("/api/v1/admin/promotions?pageSize=10")
  })

  test("end a promotion", async () => {
    // Ending sets the end to now here; the mock keeps the old end.
    const withoutEnd = (body: unknown) => {
      const { endsAt: _, ...rest } = sameIds(body)
      return rest
    }
    await write("POST", "/api/v1/admin/promotions/promo-1/end", {
      ignore: withoutEnd,
    })
    await write("POST", "/api/v1/admin/promotions/nope/end")
  })
})
