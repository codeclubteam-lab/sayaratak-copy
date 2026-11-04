import { afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { listingAnalyticsSchema } from "@sayaratak/shared/schemas/api"
import { asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { listings } from "~/modules/listings/listings.tables"

import {
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"

// Fixed, so "today" and the windows do not move while the suite runs.
const NOON = new Date("2026-11-01T12:00:00Z")

let as: Record<"user" | "dealership" | "admin", SignedIn>

beforeAll(async () => {
  await resetDb()
  as = {
    user: await signIn("user"),
    dealership: await signIn("dealership"),
    admin: await signIn("admin"),
  }
})
afterEach(() => spyOn(clock, "now").mockRestore())

const get = (path: string, who?: SignedIn) =>
  req(path, { headers: who ? { cookie: who.cookie } : {} })

const ownedBy = async (ownerUserId: string) => {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.ownerUserId, ownerUserId))
    .orderBy(asc(listings.id))
  return row?.id ?? ""
}

describe("GET /listings/:id/analytics", () => {
  test("the owner reads the series and totals of their listing", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    const id = await ownedBy("u-omar")
    const body = await expectSchema(
      await get(`/listings/${id}/analytics?range=7d`, as.user),
      listingAnalyticsSchema
    )
    expect(body.range).toBe("7d")
    expect(body.series).toHaveLength(7)
    expect(body.series.at(-1)?.day).toBe("2026-11-01")
    expect(body.totals.views).toBe(
      body.series.reduce((total, day) => total + day.views, 0)
    )
    expect(body.totals.views).toBeGreaterThan(0)
    expect(body.top).toEqual([])
  })

  test("an admin may read any listing's", async () => {
    const id = await ownedBy("u-omar")
    expect((await get(`/listings/${id}/analytics`, as.admin)).status).toBe(200)
  })

  test("another account gets 403, a missing listing 404, signed out 401", async () => {
    const id = await ownedBy("u-omar")
    expect((await get(`/listings/${id}/analytics`, as.dealership)).status).toBe(
      403
    )
    expect((await get("/listings/zzzzz/analytics", as.user)).status).toBe(404)
    expect((await get(`/listings/${id}/analytics`)).status).toBe(401)
  })

  test("a range nobody knows reads as 30 days", async () => {
    const id = await ownedBy("u-omar")
    const body = await expectSchema(
      await get(`/listings/${id}/analytics?range=weird`, as.user),
      listingAnalyticsSchema
    )
    expect(body.range).toBe("30d")
    expect(body.series).toHaveLength(30)
  })
})
