import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { listings } from "~/modules/listings/listings.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { favorites } from "./favorites.tables"

const seeded = buildSeed()
const first = seeded.favorites[0]

beforeEach(resetDb)

describe("favorite table", () => {
  test("holds every mock favorite, once per user and listing", async () => {
    expect(await db.$count(favorites)).toBe(seeded.favorites.length)
    const twice = await db
      .insert(favorites)
      .values({
        userId: first?.userId ?? "",
        listingId: first?.listingId ?? "",
        createdAt: new Date(),
      })
      .catch((error) => error)
    expect(twice.cause.errno).toBe("23505")
  })

  test("goes with a deleted listing", async () => {
    await db.delete(listings).where(eq(listings.id, first?.listingId ?? ""))
    expect(
      await db.$count(
        favorites,
        eq(favorites.listingId, first?.listingId ?? "")
      )
    ).toBe(0)
  })
})
