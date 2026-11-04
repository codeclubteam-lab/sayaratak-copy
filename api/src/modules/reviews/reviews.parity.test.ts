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

describe("GET /reviews matches the mock", () => {
  test("the public list of each kind of business, paged", async () => {
    for (const [type, id] of [
      ["dealership", "d-1"],
      ["workshop", "w-1"],
      ["mechanic", "m-1"],
    ])
      await asked(null, { path: `/reviews?targetType=${type}&targetId=${id}` })
    await asked(null, {
      path: "/reviews?targetType=workshop&targetId=w-1&page=2&pageSize=2",
    })
    await asked(null, { path: "/reviews?targetType=workshop&targetId=w-x" })
  })

  test("the owner's hidden and unanswered reviews, and a visitor asking for them", async () => {
    const owner = "/reviews?targetType=workshop&targetId=w-1"
    await asked("workshop", { path: `${owner}&includeHidden=true` })
    await asked("workshop", { path: `${owner}&needsReply=true` })
    await asked("workshop", {
      path: `${owner}&includeHidden=true&needsReply=true`,
    })
    await asked("user", { path: `${owner}&includeHidden=true` })
  })

  test("a missing target is 422", async () => {
    await asked(null, { path: "/reviews?targetType=workshop" })
  })
})

describe("writes answer as the mock does when they fail", () => {
  const body = { targetType: "dealership", targetId: "d-1", rating: 4 }

  test("signed out, an unknown business, its own owner, a bad rating", async () => {
    await asked(null, { method: "POST", path: "/reviews", body })
    await asked("user", {
      method: "POST",
      path: "/reviews",
      body: { ...body, targetId: "d-x" },
    })
    await asked("dealership", { method: "POST", path: "/reviews", body })
    await asked("user", {
      method: "POST",
      path: "/reviews",
      body: { ...body, rating: 9 },
    })
  })

  test("edit, delete, flag and reply on an unknown or foreign review", async () => {
    await asked("user", { method: "PATCH", path: "/reviews/r-nope", body: {} })
    await asked("user", { method: "PATCH", path: "/reviews/r-19", body: {} })
    await asked("user", { method: "DELETE", path: "/reviews/r-19" })
    await asked("user", { method: "POST", path: "/reviews/r-19/flag" })
    await asked("dealership", { method: "POST", path: "/reviews/r-19/flag" })
    await asked("dealership", {
      method: "POST",
      path: "/reviews/r-19/reply",
      body: { body: "Thank you" },
    })
    await asked("workshop", {
      method: "POST",
      path: "/reviews/r-114/reply",
      body: { body: "Thank you" },
    })
    await asked("workshop", {
      method: "POST",
      path: "/reviews/r-19/reply",
      body: { body: "x" },
    })
  })
})
