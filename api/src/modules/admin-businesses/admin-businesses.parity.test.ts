import { afterAll, beforeAll, describe, test } from "bun:test"
import { adminBusinessSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"

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
const write = (
  method: string,
  path: string,
  options: { body?: unknown; ignore?: (body: unknown) => unknown } = {}
) =>
  expectParity(path, {
    ignore: options.ignore,
    init: {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    },
  })

// The api names the field (`planId`) where the mock answers the bare code.
const withoutFields = (body: unknown) => {
  const { fields: _, ...rest } = body as Record<string, unknown>
  return rest
}

// Seeded businesses share creation times; the lists compare page, total and the times in order,
// the filtered lists with no ties compare exactly.
function pageAndTimes(body: unknown) {
  const { items, ...rest } = pageOf(adminBusinessSchema).parse(body)
  return { ...rest, times: items.map((item) => item.createdAt) }
}

describe("GET /admin/businesses matches the mock", () => {
  test("the table, paged", async () => {
    for (const query of ["", "?page=2", "?pageSize=7&page=3", "?type=mechanic"])
      await expectParity(`/api/v1/admin/businesses${query}`, {
        init: { headers },
        ignore: pageAndTimes,
      })
  })

  test("each filter", async () => {
    for (const query of [
      "?id=d-1",
      "?id=w-3",
      "?id=m-2",
      "?id=nope",
      "?type=dealership&pageSize=50",
      "?cityId=khartoum&pageSize=50",
      "?verified=yes&type=workshop&pageSize=50",
      "?verified=no&pageSize=50",
      "?status=suspended",
      "?planId=plan-dealer-growth",
      "?planId=plan-dealer-starter&pageSize=50",
      "?planId=plan-mechanic-basic&pageSize=50",
      "?planId=nope",
      "?q=zzzz",
      "?q=%D9%85%D8%B1%D9%83%D8%B2&pageSize=50",
    ])
      await read(`/api/v1/admin/businesses${query}`)
  })
})

describe("the business writes match the mock", () => {
  test("badge and suspension", async () => {
    await write("PATCH", "/api/v1/admin/businesses/d-1", {
      body: { verified: false },
    })
    await write("PATCH", "/api/v1/admin/businesses/d-1", {
      body: { verified: true },
    })
    await write("PATCH", "/api/v1/admin/businesses/w-2", {
      body: {
        status: "suspended",
        reason: "Fake photos",
      },
    })
    await write("PATCH", "/api/v1/admin/businesses/w-2", {
      body: {
        status: "suspended",
        reason: "Again",
      },
    })
    await write("PATCH", "/api/v1/admin/businesses/w-2", {
      body: { status: "active" },
    })
    await write("PATCH", "/api/v1/admin/businesses/d-12", {
      body: { status: "active" },
    })
    await write("PATCH", "/api/v1/admin/businesses/m-2", { body: {} })
    await write("PATCH", "/api/v1/admin/businesses/nope", {
      body: { verified: true },
    })
    await write("PATCH", "/api/v1/admin/businesses/m-3", {
      body: { status: "gone" },
    })
  })

  test("assign a plan", async () => {
    const path = (id: string) => `/api/v1/admin/businesses/${id}/assign-plan`
    await write("POST", path("d-1"), { body: { planId: "plan-dealer-pro" } })
    await write("POST", path("d-2"), {
      body: {
        planId: "plan-dealer-growth",
        price: 1000,
        limit: 5,
        durationDays: 10,
        note: "Gift",
      },
    })
    await write("POST", path("d-2"), {
      body: { planId: "plan-dealer-pro", limit: null },
    })
    await write("POST", path("w-1"), {
      body: { planId: "plan-workshop-basic" },
    })
    await write("POST", path("m-1"), {
      body: { planId: "plan-mechanic-plus", limit: 9 },
    })
    await write("POST", path("d-1"), {
      body: { planId: "plan-workshop-plus" },
      ignore: withoutFields,
    })
    await write("POST", path("d-1"), { body: { planId: "nope" } })
    await write("POST", path("nope"), { body: { planId: "plan-dealer-pro" } })
    await read("/api/v1/admin/businesses?pageSize=50&type=dealership")
  })
})
