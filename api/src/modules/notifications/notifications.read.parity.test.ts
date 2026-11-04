import { afterAll, beforeAll, describe, test } from "bun:test"

import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const asked = async (
  as: DemoAccount | null,
  request: { method?: string; path: string; body?: object }
) =>
  expectParity(`/api/v1${request.path}`, {
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

describe("GET /notifications matches the mock", () => {
  test("each account's list, unread only, a second page, and signed out", async () => {
    for (const as of [
      "user",
      "dealership",
      "workshop",
      "mechanic",
      "admin",
    ] as const)
      await asked(as, { path: "/notifications" })
    await asked("user", { path: "/notifications?unread=true" })
    await asked("user", { path: "/notifications?page=2&pageSize=2" })
    await asked(null, { path: "/notifications" })
  })
})

describe("POST /notifications/read matches the mock", () => {
  test("signed out and a bad body fail as the mock does", async () => {
    await asked(null, { method: "POST", path: "/notifications/read", body: {} })
    await asked("user", {
      method: "POST",
      path: "/notifications/read",
      body: { ids: "n-1" },
    })
  })
})
