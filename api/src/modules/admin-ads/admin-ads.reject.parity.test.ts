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

const write = (path: string, body?: unknown) =>
  expectParity(path, {
    init: {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  })

// A campaign already decided is left out: the mock rejects it too, the api answers 409 `exists` (a deviation).
describe("rejecting a campaign matches the mock", () => {
  test("a missing reason, the rejection and an unknown campaign", async () => {
    const path = (id: string) => `/api/v1/admin/campaigns/${id}/reject`
    await write(path("camp-2"), {})
    await write(path("camp-2"), { reason: "" })
    await write(path("camp-2"), { reason: "Blurry image" })
    await write(path("nope"), { reason: "x" })
    await expectParity("/api/v1/admin/campaigns", { init: { headers } })
  })
})
