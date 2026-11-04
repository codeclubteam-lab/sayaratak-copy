import { beforeAll, test } from "bun:test"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)

// The seed holds no drafts, so both answer empty data.
test("GET /drafts/:key with no draft matches the mock", async () => {
  const headers = await bothSessions("user")
  await expectParity("/api/v1/drafts/post-vehicle", { init: { headers } })
})

test("GET /drafts/:key signed out matches the mock (401)", async () => {
  await expectParity("/api/v1/drafts/post-vehicle")
})
