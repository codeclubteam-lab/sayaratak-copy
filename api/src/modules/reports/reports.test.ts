import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { listings } from "~/modules/listings/listings.tables"
import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { reports } from "./reports.tables"

const seeded = buildSeed()
const first = seeded.reports[0]

beforeEach(resetDb)

describe("report table", () => {
  test("keeps a report when its listing is deleted, with no listing", async () => {
    expect(await db.$count(reports)).toBe(seeded.reports.length)
    await db.delete(listings).where(eq(listings.id, first?.listingId ?? ""))
    const [row] = await db
      .select({ listing: reports.listingId })
      .from(reports)
      .where(eq(reports.id, first?.id ?? ""))
    expect(row).toEqual({ listing: null })
  })
})
