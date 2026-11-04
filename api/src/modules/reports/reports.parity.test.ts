import { afterAll, beforeAll, describe, test } from "bun:test"

import { bothSessions, type DemoAccount, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const asked = async (as: DemoAccount | null, body?: object) =>
  expectParity("/api/v1/reports", {
    // The answer holds a new id and time; the failures below hold none.
    init: {
      method: "POST",
      headers: {
        ...(as ? await bothSessions(as) : {}),
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: body && JSON.stringify(body),
    },
  })

const ok = { listingId: "l00001", reason: "scam" }

describe("POST /reports answers as the mock does when it fails", () => {
  test("signed out, an unknown listing, a missing detail and a bad body", async () => {
    await asked(null, ok)
    await asked("user", { ...ok, listingId: "l-nope" })
    await asked("user", { ...ok, reason: "other" })
    await asked("user", { ...ok, reason: "other", details: "  " })
    await asked("user", { ...ok, reason: "spam" })
    await asked("user", { ...ok, details: "x".repeat(1001) })
    await asked("user", {})
  })
})
