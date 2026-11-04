import { beforeEach, describe, expect, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { favoritePageSchema } from "@sayaratak/shared/schemas/listing"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { listings, listingStats } from "~/modules/listings/listings.tables"

import {
  buildSeed,
  call,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { favorites } from "./favorites.tables"

// Seed: u-omar saved 7 listings (six vehicles, one part, one tuk-tuk among them).
const seeded = buildSeed()
const mine = seeded.favorites
  .filter((f) => f.userId === "u-omar")
  .map((f) => f.listingId)
const other = seeded.listings.find((l) => !mine.includes(l.id))?.id ?? ""
const idsSchema = z.object({ ids: z.array(z.string()) })

const get = (path: string, as?: SignedIn) =>
  req(path, as && { headers: { cookie: as.cookie } })
const savedOf = async (id: string) =>
  (
    await db
      .select({ n: listingStats.favorites })
      .from(listingStats)
      .where(eq(listingStats.listingId, id))
  )[0]?.n
const page = async (as: SignedIn, query = "") =>
  expectSchema(await get(`/favorites${query}`, as), favoritePageSchema)

beforeEach(resetDb)

describe("GET /me/favorite-ids", () => {
  test("is empty signed out and holds the saved ids signed in", async () => {
    expect(
      await expectSchema(await get("/me/favorite-ids"), idsSchema)
    ).toEqual({
      ids: [],
    })
    const buyer = await signIn("user")
    const { ids } = await expectSchema(
      await get("/me/favorite-ids", buyer),
      idsSchema
    )
    expect([...ids].sort()).toEqual([...mine].sort())
  })
})

describe("GET /favorites", () => {
  test("is 401 signed out", async () => {
    expect((await get("/favorites")).status).toBe(401)
  })

  test("answers the saved listings, newest saved first, with savedAt", async () => {
    const buyer = await signIn("user")
    const result = await page(buyer)
    expect(result).toMatchObject({ total: mine.length, page: 1, pageSize: 24 })
    const dates = result.items.map((item) => item.savedAt)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(result.items.every((item) => !item.unavailable)).toBe(true)
  })

  test("sorts by price and filters by type; a bad value is ignored", async () => {
    const buyer = await signIn("user")
    const prices = (items: { price: number }[]) => items.map((i) => i.price)
    const up = prices((await page(buyer, "?sort=price_asc")).items)
    expect(up).toEqual([...up].sort((a, b) => a - b))
    const down = prices((await page(buyer, "?sort=price_desc")).items)
    expect(down).toEqual([...down].sort((a, b) => b - a))
    const parts = await page(buyer, "?type=part")
    expect(parts.items.map((i) => i.kind)).toEqual(["part"])
    expect((await page(buyer, "?type=tuk_tuk")).total).toBe(1)
    expect((await page(buyer, "?type=boat&sort=oldest")).total).toBe(
      mine.length
    )
  })

  test("pages with page and pageSize", async () => {
    const buyer = await signIn("user")
    const third = await page(buyer, "?pageSize=3&page=3")
    expect(third).toMatchObject({ total: mine.length, page: 3, pageSize: 3 })
    expect(third.items).toHaveLength(mine.length - 6)
  })

  test("flags a listing nobody can open any more, and still returns it", async () => {
    const [rejected = "", sold = "", fine = ""] = mine
    await db
      .update(listings)
      .set({ moderation: "rejected" })
      .where(eq(listings.id, rejected))
    await db
      .update(listings)
      .set({ status: "sold" })
      .where(eq(listings.id, sold))
    const buyer = await signIn("user")
    const flags = new Map(
      (await page(buyer)).items.map((i) => [i.id, i.unavailable])
    )
    expect(flags.get(rejected)).toBe(true)
    expect(flags.get(sold)).toBe(true)
    expect(flags.get(fine)).toBe(false)
  })
})

describe("POST /favorites", () => {
  const save = (as: SignedIn, body: object) =>
    call(as, "/favorites", { method: "POST", body })

  test("saves a listing and counts it once, however often or fast it is sent", async () => {
    const buyer = await signIn("user")
    const before = (await savedOf(other)) ?? 0
    await expectSchema(await save(buyer, { listingId: other }), okSchema)
    await save(buyer, { listingId: other })
    expect(await savedOf(other)).toBe(before + 1)
    expect(await db.$count(favorites, eq(favorites.listingId, other))).toBe(1)
    const again = mine[0] ?? ""
    const count = (await savedOf(again)) ?? 0
    await Promise.all([
      save(buyer, { listingId: again }),
      save(buyer, { listingId: again }),
    ])
    expect(await savedOf(again)).toBe(count)
  })

  test("two saves of a new listing at once count one", async () => {
    const buyer = await signIn("user")
    const before = (await savedOf(other)) ?? 0
    await Promise.all([
      save(buyer, { listingId: other }),
      save(buyer, { listingId: other }),
    ])
    expect(await savedOf(other)).toBe(before + 1)
  })

  test("is 401 signed out, 404 for an unknown listing, 422 without an id", async () => {
    expect((await req("/favorites", { method: "POST" })).status).toBe(401)
    const buyer = await signIn("user")
    expect((await save(buyer, { listingId: "l-nope" })).status).toBe(404)
    const res = await save(buyer, {})
    expect(res.status).toBe(422)
  })
})

describe("DELETE /favorites", () => {
  test("un-saves one listing and takes one off its counter; an unsaved one changes nothing", async () => {
    const buyer = await signIn("user")
    const id = mine[0] ?? ""
    const before = (await savedOf(id)) ?? 0
    const drop = () => call(buyer, `/favorites/${id}`, { method: "DELETE" })
    await expectSchema(await drop(), okSchema)
    await drop()
    expect(await savedOf(id)).toBe(before - 1)
    expect(
      (await call(buyer, "/favorites/l-nope", { method: "DELETE" })).status
    ).toBe(200)
    expect(await db.$count(favorites, eq(favorites.userId, "u-omar"))).toBe(
      mine.length - 1
    )
  })

  test("un-saves all of the account's listings and every counter follows", async () => {
    const buyer = await signIn("user")
    const rows = await db
      .select({ id: listingStats.listingId, n: listingStats.favorites })
      .from(listingStats)
      .where(inArray(listingStats.listingId, mine))
    await expectSchema(
      await call(buyer, "/favorites", { method: "DELETE" }),
      okSchema
    )
    expect(await db.$count(favorites, eq(favorites.userId, "u-omar"))).toBe(0)
    for (const row of rows)
      expect(await savedOf(row.id)).toBe(Math.max(0, row.n - 1))
    expect((await req("/favorites", { method: "DELETE" })).status).toBe(401)
  })
})
