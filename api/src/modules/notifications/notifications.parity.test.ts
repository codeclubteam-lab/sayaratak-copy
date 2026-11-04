import { beforeAll, test } from "bun:test"

import { bothSessions, DEMO_ACCOUNTS, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)

for (const as of DEMO_ACCOUNTS) {
  test(`GET /me/counts as ${as} matches the mock`, async () => {
    const headers = await bothSessions(as)
    await expectParity("/api/v1/me/counts", { init: { headers } })
  })
}

test("GET /me/counts signed out matches the mock (401)", async () => {
  await expectParity("/api/v1/me/counts")
})
