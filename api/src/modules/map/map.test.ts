import { beforeEach, describe, expect, test } from "bun:test"
import { mapResponseSchema } from "@sayaratak/shared/schemas/responses"
import { and, asc, eq, isNotNull } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"
import { listings } from "~/modules/listings/listings.tables"
import { cities } from "~/modules/taxonomy/taxonomy.tables"

import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

beforeEach(resetDb)

const map = async (query: string, cookie = "") =>
  expectSchema(
    await req(`/map?${query}`, { headers: { cookie } }),
    mapResponseSchema
  )

const round = (n: number) => Math.round(n * 100) / 100

describe("GET /map", () => {
  test("every layer by default, 300 points at most, total counts them all", async () => {
    const all = await map("")
    const kinds = new Set(all.items.map((p) => p.kind))
    expect(kinds).toEqual(
      new Set(["vehicle", "dealership", "workshop", "mechanic"])
    )
    expect(all.items.length).toBeLessThanOrEqual(300)
    const each = await Promise.all(
      ["vehicles", "dealerships", "workshops", "mechanics"].map((l) =>
        map(`layers=${l}`)
      )
    )
    expect(all.total).toBe(each.reduce((sum, m) => sum + m.total, 0))
  })

  test("only points inside the box", async () => {
    const box = [32.4, 15.4, 32.7, 15.8] as const
    const inside = await map(`bbox=${box.join(",")}`)
    expect(inside.items.length).toBeGreaterThan(0)
    for (const { location } of inside.items) {
      expect(location.lng).toBeGreaterThanOrEqual(round(box[0]) - 0.01)
      expect(location.lat).toBeLessThanOrEqual(round(box[3]) + 0.01)
    }
    expect((await map("bbox=0,0,1,1")).total).toBe(0)
  })

  test("rounds vehicle pins for others; the owner sees them exact", async () => {
    const [row] = await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.ownerUserId, DEMO_IDS.user),
          eq(listings.moderation, "approved"),
          eq(listings.kind, "vehicle"),
          isNotNull(listings.lat)
        )
      )
      .orderBy(asc(listings.id))
      .limit(1)
    if (!row?.lat || !row.lng) throw new Error("no pinned vehicle of u-omar")
    const pointOf = async (cookie?: string) =>
      (await map("layers=vehicles&includeSold=true", cookie)).items.find(
        (p) => p.id === row.id
      )
    expect((await pointOf())?.location).toEqual({
      lat: round(row.lat),
      lng: round(row.lng),
    })
    const own = await pointOf((await signIn("user")).cookie)
    expect(own?.location).toEqual({ lat: row.lat, lng: row.lng })
  })

  test("a banned owner's dealership leaves the map, mechanics sit at their city center", async () => {
    const [dealer] = await db
      .select()
      .from(dealerships)
      .where(eq(dealerships.ownerUserId, DEMO_IDS.dealership))
    if (!dealer) throw new Error("no demo dealership")
    const ids = async () =>
      (await map("layers=dealerships")).items.map((p) => p.id)
    expect(await ids()).toContain(dealer.id)
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, DEMO_IDS.dealership))
    expect(await ids()).not.toContain(dealer.id)

    const centers = await db.select().from(cities)
    for (const point of (await map("layers=mechanics")).items)
      expect(
        centers.some(
          (c) => c.lat === point.location.lat && c.lng === point.location.lng
        )
      ).toBe(true)
  })
})
