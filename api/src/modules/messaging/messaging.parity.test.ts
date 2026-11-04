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

// Seed: u-omar is in t-6 to t-9 and more, u-dealer in t-1 to t-3 and more, u-workshop in t-4, t-10, t-12.
describe("GET /threads matches the mock", () => {
  test("each account's conversations, and signed out", async () => {
    for (const as of [
      "user",
      "dealership",
      "workshop",
      "mechanic",
      "admin",
    ] as const)
      await asked(as, { path: "/threads" })
    await asked(null, { path: "/threads" })
  })
})

describe("GET /threads/:id/messages matches the mock", () => {
  test("a page, the second page, another account's thread and an unknown one", async () => {
    await asked("user", { path: "/threads/t-6/messages" })
    await asked("user", { path: "/threads/t-6/messages?page=2&pageSize=1" })
    await asked("user", { path: "/threads/t-6/messages?limit=2" })
    await asked("dealership", { path: "/threads/t-6/messages" })
    await asked("user", { path: "/threads/t-nope/messages" })
    await asked(null, { path: "/threads/t-6/messages" })
  })
})

describe("writes answer as the mock does when they fail", () => {
  test("signed out, a bad body, an unknown subject, your own listing, another account's thread", async () => {
    const body = { subjectType: "listing", subjectId: "l0007b", body: "hello" }
    await asked(null, { method: "POST", path: "/threads", body })
    await asked("user", {
      method: "POST",
      path: "/threads",
      body: { ...body, body: "" },
    })
    await asked("user", {
      method: "POST",
      path: "/threads",
      body: { ...body, subjectId: "l-nope" },
    })
    await asked("dealership", { method: "POST", path: "/threads", body })
    await asked("dealership", {
      method: "POST",
      path: "/threads/t-6/messages",
      body: { body: "hi" },
    })
    await asked("user", {
      method: "POST",
      path: "/threads/t-nope/messages",
      body: { body: "hi" },
    })
    await asked("user", {
      method: "POST",
      path: "/threads/t-6/messages",
      body: { body: " " },
    })
    await asked("dealership", { method: "POST", path: "/threads/t-6/read" })
    await asked("user", { method: "POST", path: "/threads/t-nope/read" })
  })
})
