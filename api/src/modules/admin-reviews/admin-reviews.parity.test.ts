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
const write = (path: string) =>
  expectParity(path, { init: { method: "POST", headers } })

describe("GET /admin/reviews matches the mock", () => {
  test("the table with paging and each filter", async () => {
    for (const query of [
      "",
      "?page=2",
      "?pageSize=7&page=3",
      "?pageSize=100",
      "?status=flagged",
      "?status=hidden",
      "?status=visible&pageSize=50",
      "?targetType=workshop",
      "?targetType=mechanic&pageSize=50",
      "?rating=1",
      "?rating=5&pageSize=50",
      "?rating=abc",
      "?id=r-117",
      "?id=r-1",
      "?status=flagged&rating=5",
      "?q=zzzz",
    ])
      await read(`/api/v1/admin/reviews${query}`)
  })

  test("the text search", async () => {
    for (const q of [
      "%D8%A7%D9%84%D8%B7%D9%8A%D8%A8",
      "al%20amal",
      "%D8%A7%D9%84%D8%A3%D9%85%D9%84",
      "%D8%B3%D8%B1%D8%B9%D8%A9",
      "AL%20AMAL%20AUTO",
    ])
      await read(`/api/v1/admin/reviews?q=${q}&pageSize=50`)
  })
})

describe("hide and show match the mock", () => {
  test("hide, show, repeats and an unknown review", async () => {
    await write("/api/v1/admin/reviews/r-19/hide")
    await read("/api/v1/admin/reviews?status=hidden")
    await write("/api/v1/admin/reviews/r-19/hide")
    await write("/api/v1/admin/reviews/r-19/show")
    await write("/api/v1/admin/reviews/r-114/show")
    await write("/api/v1/admin/reviews/r-117/hide")
    await write("/api/v1/admin/reviews/r-118/show")
    await read("/api/v1/admin/reviews?status=flagged")
    await write("/api/v1/admin/reviews/r-9999/hide")
    await write("/api/v1/admin/reviews/r-9999/show")
  })
})
