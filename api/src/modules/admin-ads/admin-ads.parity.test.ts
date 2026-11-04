import { afterAll, beforeAll, describe, test } from "bun:test"
import { adPageIdSchema } from "@sayaratak/shared/schemas/ads"

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

const read = (path: string) => expectParity(path, { init: { headers } })
const write = (method: string, path: string, body?: unknown) =>
  expectParity(path, {
    init: {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

describe("the ads admin reads match the mock", () => {
  test("campaigns and ad pages", async () => {
    await read("/api/v1/admin/campaigns")
    await read("/api/v1/admin/ad-pages")
  })
})

describe("the ad page edits match the mock", () => {
  test("price, slots, switch, nothing, bad values and an unknown page", async () => {
    const path = (id: string) => `/api/v1/admin/ad-pages/${id}`
    await write("PATCH", path("home_top"), { weeklyPrice: 350000, slots: 4 })
    await write("PATCH", path("search_car"), { enabled: false })
    await write("PATCH", path("search_car"), {})
    await write("PATCH", path("home_top"), { slots: 0 })
    await write("PATCH", path("home_top"), { weeklyPrice: -1 })
    await write("PATCH", path("nope"), { slots: 2 })
    for (const id of adPageIdSchema.options.slice(0, 2)) await read(path(id))
    await read("/api/v1/admin/ad-pages")
  })
})

describe("approving a campaign matches the mock", () => {
  test("approve, approve again, an approved campaign and an unknown one", async () => {
    const path = (id: string) => `/api/v1/admin/campaigns/${id}/approve`
    await write("POST", path("camp-2"))
    await write("POST", path("camp-2"))
    await write("POST", path("camp-1"))
    await write("POST", path("nope"))
    await read("/api/v1/admin/campaigns")
  })
})
