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

const read = (path: string) => expectParity(path, { init: { headers } })
const write = (path: string, body?: unknown) =>
  expectParity(path, {
    init: {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

describe("GET /admin/reports matches the mock", () => {
  test("the queue with paging and each filter", async () => {
    for (const query of [
      "",
      "?pageSize=2&page=2",
      "?status=open",
      "?status=resolved",
      "?status=dismissed",
      "?status=actioned",
      "?status=zzzz",
      "?id=rp-1",
      "?id=rp-5",
      "?id=zzzz",
    ])
      await read(`/api/v1/admin/reports${query}`)
  })

  test("the text search", async () => {
    for (const q of [
      "new%20visitor",
      "NEW",
      "%D9%84%D8%A7%D9%86%D8%AF",
      "peugeot",
      "zzzz",
    ])
      await read(`/api/v1/admin/reports?q=${q}`)
  })
})

describe("dismiss and action match the mock", () => {
  test("dismiss with and without a note, and an unknown report", async () => {
    await write("/api/v1/admin/reports/rp-3/dismiss", { note: "Looks fine" })
    await write("/api/v1/admin/reports/rp-9999/dismiss", {})
    await read("/api/v1/admin/reports?status=resolved")
  })

  test("remove closes every open report on the listing", async () => {
    await write("/api/v1/admin/reports/rp-2/action", { note: "Removed" })
    await read("/api/v1/admin/reports")
    await write("/api/v1/admin/reports/rp-9999/action", {})
  })

  test("a ban closes the report and shows the seller banned", async () => {
    await write("/api/v1/admin/reports/rp-4/action", {
      note: "Banned",
      ban: { reason: "Fake photos", duration: "30d" },
    })
    await read("/api/v1/admin/reports")
  })
})
