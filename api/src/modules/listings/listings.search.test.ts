import { beforeEach, describe, expect, test } from "bun:test"
import { listingPageSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"

import { expectSchema, req, resetDb } from "../../../tests/helpers"
import { capPaid } from "./listings.ranking.service"
import { listings } from "./listings.tables"

beforeEach(resetDb)

const page = async (query: string) =>
  expectSchema(await req(`/listings?${query}`), listingPageSchema)

describe("GET /listings", () => {
  test("answers 24 a page with the total and facets, public and approved only", async () => {
    const first = await page("sort=newest")
    expect(first.pageSize).toBe(24)
    expect(first.items).toHaveLength(24)
    expect(first.total).toBeGreaterThan(24)
    expect(
      first.items.every(
        (l) => l.moderation === "approved" && l.kind === "vehicle"
      )
    ).toBe(true)
    expect(
      first.items.some((l) => l.status === "sold" || l.status === "rented")
    ).toBe(false)
    expect(first.facets.make.length).toBeGreaterThan(0)
  })

  test("a page past the last is empty, not an error", async () => {
    const past = await page("sort=newest&page=999")
    expect(past.items).toEqual([])
    expect(past.total).toBeGreaterThan(0)
  })

  test("rails: limit is 1 to 24 and exclude leaves a listing out", async () => {
    const six = await page("sort=newest&limit=6")
    expect(six.items).toHaveLength(6)
    expect((await page("sort=newest&limit=500")).pageSize).toBe(24)
    const first = six.items[0]?.id ?? ""
    const without = await page(`sort=newest&limit=6&exclude=${first}`)
    expect(without.items.some((l) => l.id === first)).toBe(false)
  })

  test("drops a bad value instead of failing", async () => {
    const all = await page("sort=newest")
    const bad = await page("sort=newest&minPrice=-5&radius=7&sort=sideways")
    expect(bad.total).toBe(all.total)
  })

  test("a word with % or _ matches only itself", async () => {
    const [row] = await db
      .select()
      .from(listings)
      .where(eq(listings.moderation, "approved"))
      .limit(1)
    await db
      .update(listings)
      .set({ searchText: "50%_off deal" })
      .where(eq(listings.id, row?.id ?? ""))
    const exact = await page("q=50%25_off&sort=newest")
    expect(exact.items.map((l) => l.id)).toEqual([row?.id ?? ""])
    expect((await page("q=5%25f&sort=newest")).total).toBe(0)
  })

  test("leaves out a banned owner's listings and their facet counts", async () => {
    const all = await page("seller=u-dealer&sort=newest")
    expect(all.total).toBeGreaterThan(0)
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-dealer"))
    const after = await page("seller=u-dealer&sort=newest")
    expect(after.total).toBe(0)
    expect(after.facets.make).toEqual([])
  })

  test("facets count without their own filter: picking a make still lists the others", async () => {
    const toyota = await page("make=toyota&sort=newest")
    expect(toyota.items.every((l) => l.makeId === "toyota")).toBe(true)
    expect(toyota.facets.make.length).toBeGreaterThan(1)
    const counts = toyota.facets.make.map((f) => f.count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  test("relevance opens each page with up to 4 Featured, then one leads each row of 4", async () => {
    const featured = new Set<string>()
    for (const n of [1, 2, 3])
      for (const l of (await page(`featured=true&sort=newest&page=${n}`)).items)
        featured.add(l.id)
    expect(featured.size).toBeGreaterThan(0)
    const first = await page("sort=relevance")
    const slots = first.items.flatMap((l, i) => (featured.has(l.id) ? [i] : []))
    const paidSlots = [0, 1, 2, 3, 4, 8, 12, 16, 20]
    expect(slots).toEqual(paidSlots.slice(0, featured.size))
    // Same order while a buyer pages through, and no listing twice.
    expect((await page("sort=relevance")).items).toEqual(first.items)
    const ids = [first, await page("page=2"), await page("page=3")].flatMap(
      (p) => p.items.map((l) => l.id)
    )
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("capPaid", () => {
  test("keeps leftover Featured for the next page and turns them by the hour", () => {
    const paid = Array.from({ length: 12 }, (_, i) => `f${i}`)
    const organic = Array.from({ length: 40 }, (_, i) => `o${i}`)
    const out = capPaid(paid, organic, 0)
    expect(out).toHaveLength(52)
    const isPaid = (id: string | undefined) => id?.startsWith("f")
    expect(out.slice(0, 24).filter(isPaid)).toHaveLength(9)
    expect(out.slice(24, 28).map(isPaid)).toEqual([true, true, true, false])
    expect(out.filter((id) => id.startsWith("o"))).toEqual(organic)
    const later = capPaid(paid, organic, 3_600_000)
    expect(later.slice(0, 4)).not.toEqual(out.slice(0, 4))
  })
})
