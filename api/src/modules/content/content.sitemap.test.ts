import { beforeEach, describe, expect, test } from "bun:test"
import { sitemapEntrySchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"
import { listings } from "~/modules/listings/listings.tables"

import { buildSeed, expectSchema, req, resetDb } from "../../../tests/helpers"

const seeded = buildSeed()

beforeEach(resetDb)

async function getPaths() {
  const res = await req("/sitemap")
  expect(res.status).toBe(200)
  const entries = await expectSchema(res, z.array(sitemapEntrySchema))
  return entries.map((entry) => entry.path)
}

// An approved, available vehicle whose owner is the demo dealership.
const car = seeded.listings.find(
  (l) =>
    l.ownerUserId === "u-dealer" &&
    l.kind === "vehicle" &&
    l.moderation === "approved" &&
    l.status === "available"
)

describe("GET /sitemap", () => {
  test("lists the static pages first, then landings, listings and profiles", async () => {
    const paths = await getPaths()
    expect(paths.slice(0, 9)).toEqual([
      "",
      "/dealerships",
      "/workshops",
      "/mechanics",
      "/parts",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
    ])
    expect(paths).toContain("/vehicles/cars/sale")
    expect(paths.some((p) => p.startsWith("/listing/"))).toBe(true)
    expect(paths.some((p) => p.startsWith("/dealerships/"))).toBe(true)
  })

  test("adds a city landing for each city that has a vehicle for it", async () => {
    const slug = { car: "cars", truck: "trucks" } as const
    const paths = await getPaths()
    const type = car?.vehicleType === "truck" ? "truck" : "car"
    expect(paths).toContain(
      `/vehicles/${slug[type]}/${car?.intent}/${car?.cityId}`
    )
  })

  test("gives each listing page its last change time", async () => {
    const res = await req("/sitemap")
    const entries = z.array(sitemapEntrySchema).parse(await res.json())
    const entry = entries.find((e) => e.path === `/listing/${car?.slug}`)
    expect(entry?.lastmod).toBe(
      (
        await db
          .select({ at: listings.updatedAt })
          .from(listings)
          .where(eq(listings.slug, car?.slug ?? ""))
      )[0]?.at.toISOString()
    )
  })

  test("leaves out a listing that is pending or sold", async () => {
    const path = `/listing/${car?.slug}`
    expect(await getPaths()).toContain(path)
    await db
      .update(listings)
      .set({ moderation: "pending" })
      .where(eq(listings.slug, car?.slug ?? ""))
    expect(await getPaths()).not.toContain(path)
    await db
      .update(listings)
      .set({ moderation: "approved", status: "sold" })
      .where(eq(listings.slug, car?.slug ?? ""))
    expect(await getPaths()).not.toContain(path)
  })

  test("leaves out a banned owner's listings and profile, and a suspended profile", async () => {
    const dealer = seeded.dealerships.find((d) => d.ownerId === "u-dealer")
    expect(await getPaths()).toContain(`/dealerships/${dealer?.slug}`)
    await db
      .update(dealerships)
      .set({ status: "suspended" })
      .where(eq(dealerships.ownerUserId, "u-dealer"))
    const suspended = await getPaths()
    expect(suspended).not.toContain(`/dealerships/${dealer?.slug}`)
    expect(suspended).not.toContain(`/listing/${car?.slug}`)

    await db
      .update(dealerships)
      .set({ status: "active" })
      .where(eq(dealerships.ownerUserId, "u-dealer"))
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-dealer"))
    const banned = await getPaths()
    expect(banned).not.toContain(`/dealerships/${dealer?.slug}`)
    expect(banned).not.toContain(`/listing/${car?.slug}`)
  })

  test("never lists search, map or a dashboard", async () => {
    const paths = await getPaths()
    expect(paths.some((p) => /^\/(search|map|admin|account)/.test(p))).toBe(
      false
    )
  })
})
