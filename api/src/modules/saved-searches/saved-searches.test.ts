import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { savedSearches } from "./saved-searches.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("saved search table", () => {
  test("keeps each search's params as an object", async () => {
    const first = seeded.savedSearches[0]
    if (!first) throw new Error("the mock seeds saved searches")
    expect(await db.$count(savedSearches)).toBe(seeded.savedSearches.length)
    const [row] = await db
      .select({ params: savedSearches.params })
      .from(savedSearches)
      .where(eq(savedSearches.id, first.id))
    expect(row?.params).toEqual(first.params)
  })
})
