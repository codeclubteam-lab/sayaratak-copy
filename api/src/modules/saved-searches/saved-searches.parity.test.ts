import { afterAll, beforeAll, describe, test } from "bun:test"

import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const asked = async (
  as: DemoAccount | null,
  request: {
    method?: string
    path: string
    body?: object
    ignore?: (body: unknown) => unknown
  }
) =>
  expectParity(`/api/v1${request.path}`, {
    ignore: request.ignore,
    init: {
      method: request.method,
      headers: {
        ...(as ? await bothSessions(as) : {}),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: request.body && JSON.stringify(request.body),
    },
  })

// The mock lists in the order it saved them, the api by the day saved; the seed's dates are not in that order.
const byId = (body: unknown) =>
  Array.isArray(body)
    ? [...body].sort((a, b) => a.id.localeCompare(b.id))
    : body

describe("GET /saved-searches matches the mock", () => {
  test("the user's own searches, an account with none, and signed out", async () => {
    await asked("user", { path: "/saved-searches", ignore: byId })
    await asked("dealership", { path: "/saved-searches" })
    await asked(null, { path: "/saved-searches" })
  })
})

describe("writes answer as the mock does when they fail", () => {
  test("signed out, a bad name, another account's or an unknown search", async () => {
    const body = { name: "x", params: { kind: "vehicle" } }
    await asked(null, { method: "POST", path: "/saved-searches", body })
    await asked("user", {
      method: "POST",
      path: "/saved-searches",
      body: { ...body, name: "" },
    })
    await asked("user", {
      method: "PATCH",
      path: "/saved-searches/ss-nope",
      body: {},
    })
    await asked("dealership", {
      method: "PATCH",
      path: "/saved-searches/ss-1",
      body: { name: "y" },
    })
    await asked("user", {
      method: "PATCH",
      path: "/saved-searches/ss-1",
      body: { name: "x".repeat(61) },
    })
    await asked("dealership", {
      method: "DELETE",
      path: "/saved-searches/ss-1",
    })
    await asked("user", { method: "DELETE", path: "/saved-searches/ss-nope" })
  })
})
