import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { reviews } from "./reviews.tables"

const seeded = buildSeed()
const first = seeded.reviews[0]
if (!first) throw new Error("the mock seeds reviews")

beforeEach(resetDb)

describe("review table", () => {
  test("holds every mock review with its reply", async () => {
    expect(await db.$count(reviews)).toBe(seeded.reviews.length)
    expect(await db.$count(reviews, eq(reviews.status, "flagged"))).toBe(
      seeded.reviews.filter((r) => r.status === "flagged").length
    )
  })

  test("refuses a second review of one business by one author, and a rating out of 1 to 5", async () => {
    const twice = await db
      .insert(reviews)
      .values({ ...first, id: "r-x", createdAt: new Date() })
      .catch((error) => error)
    expect(twice.cause.errno).toBe("23505")
    const rating = await db
      .update(reviews)
      .set({ rating: 6 })
      .where(eq(reviews.id, first.id))
      .catch((error) => error)
    expect(rating.cause.constraint).toBe("reviews_rating")
  })

  test("keeps a deleted author's review under their name", async () => {
    await db.delete(user).where(eq(user.id, first.authorId))
    const [row] = await db
      .select({ author: reviews.authorId, name: reviews.authorName })
      .from(reviews)
      .where(eq(reviews.id, first.id))
    expect(row).toEqual({ author: null, name: first.authorName })
  })
})
