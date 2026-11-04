import { beforeAll, test } from "bun:test"

import { bothSessions, DEMO_ACCOUNTS, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)

for (const as of DEMO_ACCOUNTS) {
  test(`GET /me as ${as} matches the mock`, async () => {
    const headers = await bothSessions(as)
    await expectParity("/api/v1/me", { init: { headers } })
  })

  test(`GET /me/notification-prefs as ${as} matches the mock`, async () => {
    const headers = await bothSessions(as)
    await expectParity("/api/v1/me/notification-prefs", { init: { headers } })
  })
}

test("GET /me signed out matches the mock (null)", async () => {
  await expectParity("/api/v1/me")
})

test("GET /me/notification-prefs signed out matches the mock (401)", async () => {
  await expectParity("/api/v1/me/notification-prefs")
})
