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

// The mock lists ids in the order it saved them, the api by day saved; the web reads them as a set.
const sortedIds = (body: unknown) => {
  const ids = (body as { ids?: string[] }).ids
  return ids ? { ids: [...ids].sort() } : body
}

describe("GET /favorites matches the mock", () => {
  test("the saved list in every sort, type and page", async () => {
    for (const query of [
      "",
      "?sort=price_asc",
      "?sort=price_desc",
      "?type=part",
      "?type=tuk_tuk&sort=price_desc",
      "?pageSize=3&page=2",
      "?type=boat&sort=oldest",
    ])
      await asked("user", { path: `/favorites${query}` })
    await asked("dealership", { path: "/favorites" })
  })

  test("signed out it is 401", async () => {
    await asked(null, { path: "/favorites" })
  })
})

describe("GET /me/favorite-ids matches the mock", () => {
  test("empty signed out, the saved ids signed in", async () => {
    await asked(null, { path: "/me/favorite-ids" })
    await asked("user", { path: "/me/favorite-ids", ignore: sortedIds })
  })
})

describe("writes answer as the mock does when they change nothing", () => {
  test("signed out, an unknown listing, a missing id, an unsaved listing", async () => {
    await asked(null, {
      method: "POST",
      path: "/favorites",
      body: { listingId: "l0003j" },
    })
    await asked("user", {
      method: "POST",
      path: "/favorites",
      body: { listingId: "l-nope" },
    })
    await asked("user", { method: "POST", path: "/favorites", body: {} })
    await asked(null, { method: "DELETE", path: "/favorites/l0003j" })
    await asked("user", { method: "DELETE", path: "/favorites/l-nope" })
  })
})
