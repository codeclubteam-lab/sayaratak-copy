import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { listings } from "~/modules/listings/listings.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { promotionPrices, promotions } from "./promotions.tables"

const seeded = buildSeed()
const unpaid = seeded.promotions.find((p) => p.status === "pending_payment")
if (!unpaid) throw new Error("the mock seeds unpaid promotions")

beforeEach(resetDb)

describe("promotion tables", () => {
  test("hold every mock price and promotion", async () => {
    expect(await db.$count(promotionPrices)).toBe(seeded.promotionPrices.length)
    expect(await db.$count(promotions)).toBe(seeded.promotions.length)
  })

  test("keep one unpaid order per listing, type and length", async () => {
    const error = await db
      .insert(promotions)
      .values({ ...unpaid, id: "promo-x", startsAt: null, endsAt: null })
      .catch((error) => error)
    expect(error.cause.constraint).toBe("promotions_one_unpaid")
  })

  test("refuse a running promotion without dates, and go with the listing", async () => {
    const error = await db
      .update(promotions)
      .set({ status: "active" })
      .where(eq(promotions.id, unpaid.id))
      .catch((error) => error)
    expect(error.cause.constraint).toBe("promotions_dates")
    await db.delete(listings).where(eq(listings.id, unpaid.listingId))
    expect(await db.$count(promotions, eq(promotions.id, unpaid.id))).toBe(0)
  })
})
