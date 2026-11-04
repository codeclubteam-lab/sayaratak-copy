import { beforeAll, describe, test } from "bun:test"
import { and, asc, eq, isNotNull, ne } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { bothSessions, DEMO_IDS, resetDb } from "../../../tests/helpers"
import { expectParity } from "../../../tests/parity"
import { listings } from "./listings.tables"

beforeAll(resetDb)

async function firstListing(where: Parameters<typeof and>) {
  const [row] = await db
    .select({ id: listings.id, slug: listings.slug })
    .from(listings)
    .where(and(...where))
    .orderBy(asc(listings.id))
    .limit(1)
  if (!row) throw new Error("the seed has no such listing")
  return row
}

describe("GET /listings/:slug", () => {
  test("an approved listing with a map pin, signed out", async () => {
    const row = await firstListing([
      eq(listings.moderation, "approved"),
      isNotNull(listings.lat),
    ])
    await expectParity(`/api/v1/listings/${row.slug}`)
  })

  test("an approved listing seen by its owner (exact pin)", async () => {
    const row = await firstListing([
      eq(listings.moderation, "approved"),
      eq(listings.ownerUserId, DEMO_IDS.user),
    ])
    await expectParity(`/api/v1/listings/${row.slug}`, {
      init: { headers: await bothSessions("user") },
    })
  })

  test("the owner's own draft or rejected listing", async () => {
    const row = await firstListing([
      ne(listings.moderation, "approved"),
      eq(listings.ownerUserId, DEMO_IDS.user),
    ])
    await expectParity(`/api/v1/listings/${row.slug}`, {
      init: { headers: await bothSessions("user") },
    })
  })

  test("someone else's unapproved listing: 404 for a stranger, shown to an admin", async () => {
    const row = await firstListing([
      ne(listings.moderation, "approved"),
      ne(listings.ownerUserId, DEMO_IDS.dealership),
    ])
    await expectParity(`/api/v1/listings/${row.slug}`, {
      init: { headers: await bothSessions("dealership") },
    })
    await expectParity(`/api/v1/listings/${row.slug}`, {
      init: { headers: await bothSessions("admin") },
    })
  })

  test("a dealership's listing, an old slug and an unknown id", async () => {
    const row = await firstListing([
      eq(listings.moderation, "approved"),
      eq(listings.ownerType, "dealership"),
    ])
    await expectParity(`/api/v1/listings/${row.slug}`)
    await expectParity(`/api/v1/listings/an-old-title-${row.id}`)
    await expectParity("/api/v1/listings/nothing-lzzzzz")
  })
})

describe("GET /listings/:id/similar", () => {
  test("for a car and for a part", async () => {
    const car = await firstListing([
      eq(listings.moderation, "approved"),
      eq(listings.vehicleType, "car"),
    ])
    await expectParity(`/api/v1/listings/${car.id}/similar`)
    const part = await firstListing([
      eq(listings.moderation, "approved"),
      eq(listings.kind, "part"),
    ])
    await expectParity(`/api/v1/listings/${part.id}/similar`)
    await expectParity("/api/v1/listings/lzzzzz/similar")
  })
})
