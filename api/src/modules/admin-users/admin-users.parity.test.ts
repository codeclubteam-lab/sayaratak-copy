import { afterAll, beforeAll, describe, test } from "bun:test"
import { adminUserSchema } from "@sayaratak/shared/schemas/admin"
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

const read = (path: string, ignore?: (body: unknown) => unknown) =>
  expectParity(path, { init: { headers }, ignore })

// Seeded accounts share creation times (whole days before the seed), and the mock keeps ties
// in its array order (demo accounts first) while the api breaks them by id. The long lists
// are compared by page, total and the times in order; the filtered lists, with no ties, exactly.
function pageAndTimes(body: unknown) {
  const { items, ...rest } = pageOf(adminUserSchema).parse(body)
  return { ...rest, times: items.map((item) => item.createdAt) }
}
const write = (path: string, body?: unknown) =>
  expectParity(path, {
    init: {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

describe("GET /admin/users matches the mock", () => {
  test("the table with each filter", async () => {
    for (const query of [
      "",
      "?page=2",
      "?pageSize=7&page=3",
      "?status=active&pageSize=50",
    ])
      await read(`/api/v1/admin/users${query}`, pageAndTimes)
    for (const query of [
      "?role=dealership",
      "?role=mechanic&pageSize=50",
      "?role=admin",
      "?status=banned",
      "?id=u-omar",
      "?id=u-dealer",
      "?id=ud-2",
      "?q=user1@example.sy",
      "?q=%2B249923356945",
      "?q=zzzz",
    ])
      await read(`/api/v1/admin/users${query}`)
  })
})

describe("the ban writes match the mock", () => {
  const reason = "Repeated spam listings"

  test("ban for each length, ban again, and unban", async () => {
    await write("/api/v1/admin/users/u-1/ban", { reason, duration: "7d" })
    await write("/api/v1/admin/users/u-2/ban", { reason, duration: "30d" })
    await write("/api/v1/admin/users/u-3/ban", {
      reason,
      duration: "permanent",
    })
    await write("/api/v1/admin/users/u-1/ban", {
      reason: "Scam",
      duration: "permanent",
    })
    await write("/api/v1/admin/users/u-1/unban")
    await write("/api/v1/admin/users/u-58/unban")
    await write("/api/v1/admin/users/u-4/unban")
  })

  test("an admin, an unknown account and a bad body", async () => {
    await write("/api/v1/admin/users/u-admin/ban", { reason, duration: "7d" })
    await write("/api/v1/admin/users/u-admin/unban")
    await write("/api/v1/admin/users/nope/ban", { reason, duration: "7d" })
    await write("/api/v1/admin/users/nope/unban")
    await write("/api/v1/admin/users/u-5/ban", { duration: "7d" })
    await write("/api/v1/admin/users/u-5/ban", { reason, duration: "1y" })
  })
})
