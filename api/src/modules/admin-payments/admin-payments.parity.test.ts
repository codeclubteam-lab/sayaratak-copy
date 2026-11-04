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

// The seeded receipts are served from `/demo` here and from `/api/uploads` by the mock: the same files.
const sameReceipts = (body: unknown) =>
  JSON.parse(
    JSON.stringify(body).replace(/"receiptUrl":"[^"]*"/g, '"receiptUrl":""')
  )

const read = (path: string) =>
  expectParity(path, { init: { headers }, ignore: sameReceipts })
const write = (path: string, body?: unknown) =>
  expectParity(path, {
    ignore: sameReceipts,
    init: {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

describe("GET /admin/payments matches the mock", () => {
  test("the table with each filter", async () => {
    for (const query of [
      "",
      "?page=2",
      "?pageSize=5&page=2",
      "?status=pending_review",
      "?status=approved",
      "?status=rejected",
      "?status=nope",
      "?userId=u-dealer",
      "?userId=u-omar&status=approved",
      "?id=pay-4",
      "?id=pay-13",
      "?id=nope",
      "?q=SY-100",
      "?q=zzzz",
    ])
      await read(`/api/v1/admin/payments${query}`)
  })

  test("the text search by item name", async () => {
    for (const q of ["plus", "%D8%A8%D9%84%D8%B3", "growth", "bump"])
      await read(`/api/v1/admin/payments?q=${q}`)
  })
})

describe("the decisions match the mock", () => {
  test("approve a plan, a Featured and a bump", async () => {
    await write("/api/v1/admin/payments/pay-4/approve")
    await write("/api/v1/admin/payments/pay-5/approve")
    await write("/api/v1/admin/payments/pay-3/approve")
    await write("/api/v1/admin/payments/pay-4/approve")
    await read("/api/v1/admin/payments?status=approved&pageSize=50")
  })

  test("reject, and the refusals", async () => {
    await write("/api/v1/admin/payments/pay-1/reject", { reason: "Blurry" })
    await write("/api/v1/admin/payments/pay-1/reject", { reason: "Again" })
    await write("/api/v1/admin/payments/pay-2/reject", {})
    await write("/api/v1/admin/payments/pay-6/approve")
    await write("/api/v1/admin/payments/pay-12/reject", { reason: "x" })
    await write("/api/v1/admin/payments/nope/approve")
    await write("/api/v1/admin/payments/nope/reject", { reason: "x" })
    await read("/api/v1/admin/payments?status=rejected")
  })
})
