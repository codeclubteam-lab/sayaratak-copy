import { afterAll, beforeAll, describe, test } from "bun:test"

import {
  bothSessions,
  DEMO_ACCOUNTS,
  type DemoAccount,
  resetDb,
} from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

beforeAll(resetDb)
afterAll(resetDb)

const as = async (who: DemoAccount | null) => ({
  headers: who ? await bothSessions(who) : {},
})

describe("GET /plans matches the mock", () => {
  test("every plan, each audience, an unknown audience", async () => {
    await expectParity("/api/v1/plans")
    for (const audience of ["user", "dealership", "workshop", "mechanic", "x"])
      await expectParity(`/api/v1/plans?audience=${audience}`)
  })
})

describe("GET /me/subscription matches the mock", () => {
  test("every account and signed out", async () => {
    for (const who of DEMO_ACCOUNTS)
      await expectParity("/api/v1/me/subscription", { init: await as(who) })
    await expectParity("/api/v1/me/subscription", { init: await as(null) })
  })
})

describe("DELETE /me/chosen-plan matches the mock", () => {
  test("an account with no pick, and signed out", async () => {
    for (const who of ["user", "dealership", "new"] as const)
      await expectParity("/api/v1/me/chosen-plan", {
        init: {
          method: "DELETE",
          headers: {
            ...(await bothSessions(who)),
            origin: "http://localhost:3000",
          },
        },
      })
    await expectParity("/api/v1/me/chosen-plan", {
      init: { method: "DELETE", headers: { origin: "http://localhost:3000" } },
    })
  })
})
