import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test"
import { adminStatsSchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { user } from "~/modules/auth/auth.tables"
import { listings } from "~/modules/listings/listings.tables"
import { payments } from "~/modules/payments/payments.tables"

import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()
const NOON = new Date("2026-11-01T12:00:00Z")
const LONG_AGO = new Date("2020-01-01T00:00:00Z")

beforeEach(resetDb)
// The clock spy of one test must not reach the next test or file.
afterEach(() => mock.restore())

async function asAdmin(path: string) {
  const { cookie } = await signIn("admin")
  return req(path, { headers: { cookie } })
}

describe("admin reads", () => {
  test.each(["/admin/stats", "/admin/activity", "/admin/search?q=a"])(
    "%s is 401 signed out and 403 for a seller",
    async (path) => {
      const out = await req(path)
      expect(out.status).toBe(401)
      expect(await out.json()).toMatchObject({ code: "unauthenticated" })
      const { cookie } = await signIn("dealership")
      const seller = await req(path, { headers: { cookie } })
      expect(seller.status).toBe(403)
      expect(await seller.json()).toMatchObject({ code: "forbidden" })
    }
  )
})

describe("GET /admin/stats", () => {
  test("totals count what the tables hold", async () => {
    const res = await asAdmin("/admin/stats")
    expect(res.status).toBe(200)
    const { totals } = await expectSchema(res, adminStatsSchema)
    const approved = seeded.listings.filter((l) => l.moderation === "approved")
    expect(totals).toMatchObject({
      users: seeded.users.length,
      listings: approved.length,
      vehicles: approved.filter((l) => l.kind === "vehicle").length,
      dealerships: seeded.dealerships.length,
      workshops: seeded.workshops.length,
      mechanics: seeded.mechanics.length,
      activeSubscriptions: seeded.subscriptions.filter(
        (s) => s.status === "active"
      ).length,
    })
  })

  test("gives one point per Khartoum day, today last, 30 days by default", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    const days = async (query: string) => {
      const body = await expectSchema(
        await asAdmin(`/admin/stats${query}`),
        adminStatsSchema
      )
      return body.series.newUsers.map((point) => point.date)
    }
    const week = await days("?range=7d")
    expect(week).toHaveLength(7)
    expect(week[0]).toBe("2026-10-26")
    expect(week.at(-1)).toBe("2026-11-01")
    expect(await days("")).toHaveLength(30)
    expect(await days("?range=90d")).toHaveLength(90)
    expect(await days("?range=forever")).toHaveLength(30)
  })

  test("counts a new account on its Khartoum day, not its UTC day", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    await db.update(user).set({ createdAt: LONG_AGO })
    // 22:30 UTC is 00:30 the next day in Khartoum (UTC+2); 21:30 UTC is still the same day.
    await db
      .update(user)
      .set({ createdAt: new Date("2026-10-31T22:30:00Z") })
      .where(eq(user.id, "u-omar"))
    await db
      .update(user)
      .set({ createdAt: new Date("2026-10-31T21:30:00Z") })
      .where(eq(user.id, "u-dealer"))
    const { series } = await expectSchema(
      await asAdmin("/admin/stats?range=7d"),
      adminStatsSchema
    )
    const byDate = Object.fromEntries(
      series.newUsers.map((point) => [point.date, point.value])
    )
    expect(byDate).toMatchObject({ "2026-10-31": 1, "2026-11-01": 1 })
    expect(series.newUsers.reduce((sum, p) => sum + p.value, 0)).toBe(2)
  })

  test("counts new listings of any state, drafts too", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    await db.update(listings).set({ createdAt: LONG_AGO })
    const draft = seeded.listings.find((l) => l.moderation === "draft")
    await db
      .update(listings)
      .set({ createdAt: new Date("2026-11-01T08:00:00Z") })
      .where(eq(listings.id, draft?.id ?? ""))
    const { series } = await expectSchema(
      await asAdmin("/admin/stats?range=7d"),
      adminStatsSchema
    )
    expect(series.newListings.at(-1)).toEqual({ date: "2026-11-01", value: 1 })
  })

  test("revenue is approved payments on the day they were decided, or sent when never decided", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    const [first, second, third] = seeded.payments.filter(
      (p) => p.status === "approved"
    )
    await db.update(payments).set({ reviewedAt: LONG_AGO, createdAt: LONG_AGO })
    await db
      .update(payments)
      .set({ reviewedAt: new Date("2026-10-31T22:30:00Z") })
      .where(eq(payments.id, first?.id ?? ""))
    await db
      .update(payments)
      .set({ reviewedAt: null, createdAt: new Date("2026-10-30T10:00:00Z") })
      .where(eq(payments.id, second?.id ?? ""))
    const body = await expectSchema(
      await asAdmin("/admin/stats?range=7d"),
      adminStatsSchema
    )
    const byDate = Object.fromEntries(
      body.series.revenue.map((point) => [point.date, point.value])
    )
    expect(byDate["2026-11-01"]).toBe(first?.amount ?? -1)
    expect(byDate["2026-10-30"]).toBe(second?.amount ?? -1)
    expect(body.totals.revenue).toBe(
      (first?.amount ?? 0) + (second?.amount ?? 0)
    )
    expect(third).toBeDefined()
  })
})
