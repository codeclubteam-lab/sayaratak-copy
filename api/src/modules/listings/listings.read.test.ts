import { beforeEach, describe, expect, test } from "bun:test"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { and, asc, eq, isNotNull } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"

import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { listings } from "./listings.tables"

beforeEach(resetDb)

async function approvedOf(ownerUserId: string) {
  const [row] = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.ownerUserId, ownerUserId),
        eq(listings.moderation, "approved"),
        isNotNull(listings.lat)
      )
    )
    .orderBy(asc(listings.id))
    .limit(1)
  if (!row) throw new Error("no approved listing with a pin")
  return row
}

const getAs = (path: string, cookie = "") => req(path, { headers: { cookie } })

describe("GET /listings/:slug", () => {
  test("rounds the pin to 2 decimals for others; the owner sees it exact", async () => {
    const row = await approvedOf(DEMO_IDS.user)
    const stranger = await expectSchema(
      await getAs(`/listings/${row.slug}`),
      listingSchema
    )
    expect(stranger.location).toEqual({
      lat: Math.round((row.lat ?? 0) * 100) / 100,
      lng: Math.round((row.lng ?? 0) * 100) / 100,
    })
    const owner = await expectSchema(
      await getAs(`/listings/${row.slug}`, (await signIn("user")).cookie),
      listingSchema
    )
    expect(owner.location).toEqual({ lat: row.lat ?? 0, lng: row.lng ?? 0 })
  })

  test("a banned owner's listing is 404 to others while the ban runs", async () => {
    const row = await approvedOf(DEMO_IDS.user)
    const ends = new Date(Date.now() + 60_000)
    await db
      .update(user)
      .set({ banned: true, banExpires: ends })
      .where(eq(user.id, DEMO_IDS.user))
    expect((await getAs(`/listings/${row.slug}`)).status).toBe(404)
    const admin = await getAs(
      `/listings/${row.slug}`,
      (await signIn("admin")).cookie
    )
    expect(admin.status).toBe(200)
    await db
      .update(user)
      .set({ banExpires: new Date(Date.now() - 1000) })
      .where(eq(user.id, DEMO_IDS.user))
    expect((await getAs(`/listings/${row.slug}`)).status).toBe(200)
  })

  test("a suspended dealership's listing is 404 to others", async () => {
    const row = await approvedOf(DEMO_IDS.dealership)
    await db
      .update(dealerships)
      .set({ status: "suspended" })
      .where(eq(dealerships.ownerUserId, DEMO_IDS.dealership))
    expect((await getAs(`/listings/${row.slug}`)).status).toBe(404)
    const own = await getAs(
      `/listings/${row.slug}`,
      (await signIn("dealership")).cookie
    )
    expect(own.status).toBe(200)
  })
})

describe("GET /listings/:id/similar", () => {
  test("up to 8 public available listings of the same kind, intent and type, nearest price first", async () => {
    const row = await approvedOf(DEMO_IDS.dealership)
    const res = await req(`/listings/${row.id}/similar`)
    const similar = await expectSchema(res, z.array(listingSchema))
    expect(similar.length).toBeLessThanOrEqual(8)
    expect(similar.some((l) => l.id === row.id)).toBe(false)
    for (const l of similar) {
      expect(l).toMatchObject({
        kind: row.kind,
        intent: row.intent,
        vehicleType: row.vehicleType,
        status: "available",
        moderation: "approved",
      })
    }
    const gaps = similar.map((l) => Math.abs(l.price - row.price))
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b))
  })

  test("leaves out banned owners' listings", async () => {
    const row = await approvedOf(DEMO_IDS.dealership)
    const before = await expectSchema(
      await req(`/listings/${row.id}/similar`),
      z.array(listingSchema)
    )
    const [first] = before
    if (!first) throw new Error("nothing similar")
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, first.owner.id))
    const after = await expectSchema(
      await req(`/listings/${row.id}/similar`),
      z.array(listingSchema)
    )
    expect(after.some((l) => l.owner.id === first.owner.id)).toBe(false)
  })

  test("returns 404 not_found for an unknown listing", async () => {
    expect((await req("/listings/lzzzzz/similar")).status).toBe(404)
  })
})
