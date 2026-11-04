import { afterAll, beforeAll, describe, spyOn, test } from "bun:test"
import { asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { listings } from "~/modules/listings/listings.tables"

import { bothSessions, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"

// The mock counts UTC days and the api Khartoum days (UTC+2). At noon UTC they
// are the same date, so the two can be compared whatever time the suite runs.
// The time is fixed before the seeds are built, so their message times are fixed too.
const NOON = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`)

type As = "user" | "dealership" | "workshop" | "mechanic" | "admin"
const AS: As[] = ["user", "dealership", "workshop", "mechanic", "admin"]
const sessions = {} as Record<As, Awaited<ReturnType<typeof bothSessions>>>

function freeze() {
  spyOn(Date, "now").mockReturnValue(NOON.getTime())
  spyOn(clock, "now").mockReturnValue(NOON)
}

beforeAll(async () => {
  freeze()
  await resetDb()
  // Signing in (the admin's mailed code) needs the real clock; the sessions last two months.
  spyOn(Date, "now").mockRestore()
  spyOn(clock, "now").mockRestore()
  for (const as of AS) sessions[as] = await bothSessions(as)
  freeze()
})
afterAll(() => {
  spyOn(Date, "now").mockRestore()
  spyOn(clock, "now").mockRestore()
})

// Deviation: messages are counted per Khartoum day here and per UTC day in the
// mock, so a message sent between 22:00 and 24:00 UTC lands one day apart.
// analytics.test.ts checks them against the Khartoum calendar.
function withoutMessages(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(withoutMessages)
  if (typeof body !== "object" || body === null) return body
  return Object.fromEntries(
    Object.entries(body)
      .filter(([key]) => key !== "messages")
      .map(([key, value]) => [key, withoutMessages(value)])
  )
}

const mine = (query: string, as: As) =>
  expectParity(`/api/v1/me/analytics${query}`, {
    init: { headers: sessions[as] },
    ignore: withoutMessages,
  })

describe("GET /me/analytics matches the mock", () => {
  test("every role, default range", async () => {
    for (const as of AS) await mine("", as)
  })

  test("each range, and a range nobody knows", async () => {
    for (const range of ["7d", "30d", "90d", "1d", ""])
      for (const as of ["dealership", "admin"] as const)
        await mine(`?range=${range}`, as)
  })
})

describe("GET /listings/:id/analytics matches the mock", () => {
  test("a seller's, a dealership's and an admin's view of a listing, per range", async () => {
    for (const [as, owner] of [
      ["user", "u-omar"],
      ["dealership", "u-dealer"],
    ] as const) {
      const [row] = await db
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.ownerUserId, owner))
        .orderBy(asc(listings.id))
      const path = `/api/v1/listings/${row?.id}/analytics`
      for (const range of ["", "?range=7d", "?range=90d"]) {
        await expectParity(`${path}${range}`, {
          init: { headers: sessions[as] },
        })
        await expectParity(`${path}${range}`, {
          init: { headers: sessions.admin },
        })
      }
    }
  })

  test("refusals: somebody else's listing, a missing one, signed out", async () => {
    const [row] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.ownerUserId, "u-dealer"))
      .orderBy(asc(listings.id))
    const stranger = { headers: sessions.user }
    await expectParity(`/api/v1/listings/${row?.id}/analytics`, {
      init: stranger,
    })
    await expectParity("/api/v1/listings/zzzzz/analytics", { init: stranger })
    await expectParity(`/api/v1/listings/${row?.id}/analytics`)
    await expectParity("/api/v1/me/analytics")
  })
})
