import { beforeAll, describe, test } from "bun:test"
import { adminStatsSchema } from "@sayaratak/shared/schemas/responses"

import { bothSessions, buildSeed, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

// One admin sign-in for the whole file: the emailed code is capped per address.
let asAdmin: RequestInit = {}

beforeAll(async () => {
  await resetDb()
  asAdmin = { headers: await bothSessions("admin") }
})

// The api counts days on the Khartoum calendar and the mock on UTC (owner, 8.2), so a row made
// in the two hours between differs by one day. Only what no day edge can move is compared: the
// totals, and how many points each series has. The day-by-day numbers are tested with fixed
// times in admin.stats.test.ts.
function withoutDayNumbers(body: unknown) {
  const { range, totals, series } = adminStatsSchema.parse(body)
  const { revenue: _revenue, ...counts } = totals
  return {
    range,
    counts,
    points: Object.fromEntries(
      Object.entries(series).map(([name, points]) => [name, points.length])
    ),
  }
}

describe("GET /admin/stats matches the mock", () => {
  test("each range, and the default", async () => {
    for (const query of ["", "?range=7d", "?range=30d", "?range=90d"])
      await expectParity(`/api/v1/admin/stats${query}`, {
        init: asAdmin,
        ignore: withoutDayNumbers,
      })
  })
})

test("GET /admin/activity matches the mock", async () => {
  await expectParity("/api/v1/admin/activity", { init: asAdmin })
})

describe("GET /admin/search matches the mock", () => {
  test("blank, a listing, an account, a business and a payment", async () => {
    for (const q of [
      "",
      "peugeot",
      "dealer@demo.sy",
      "l00007",
      "SY-",
      "no such thing",
    ])
      await expectParity(`/api/v1/admin/search?q=${encodeURIComponent(q)}`, {
        init: asAdmin,
      })
  })

  test("names of businesses, in both languages", async () => {
    const [first] = buildSeed().dealerships
    for (const q of [first?.name.en ?? "", first?.name.ar ?? ""])
      await expectParity(`/api/v1/admin/search?q=${encodeURIComponent(q)}`, {
        init: asAdmin,
      })
  })
})
