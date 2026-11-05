import { beforeEach, describe, expect, test } from "bun:test"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"

import { db } from "~/shared/db/client"

import { resetDb } from "../../../tests/helpers"
import { countFacet, countFacets } from "./listings.facets.queries"
import { type FacetKey, searchWhere } from "./listings.filters.queries"
import { scopeOf } from "./listings.search.service"
import { listings } from "./listings.tables"

beforeEach(resetDb)

const KEYS: FacetKey[] = ["type", "make", "fuel", "transmission", "city"]
const byValue = (rows: { value: string; count: number }[]) =>
  [...rows].sort((a, b) => a.value.localeCompare(b.value))

describe("countFacets", () => {
  // Counting the facets whose filter is not set in one pass must give what one query each gives.
  test.each([
    {},
    { make: "toyota", fuel: "petrol" },
    { kind: "part" },
    { city: "khartoum", type: "car", transmission: "automatic" },
    { q: "toyota", minPrice: "1000" },
  ])("%o: the same counts as one query per facet", async (query) => {
    const params = searchParamsSchema.parse({
      kind: "vehicle",
      ...query,
      fuel: undefined === query.fuel ? undefined : [query.fuel],
      transmission:
        undefined === query.transmission ? undefined : [query.transmission],
    })
    const scope = await scopeOf(db, params)
    const { counts: together, total } = await countFacets(db, {
      params,
      scope,
      keys: KEYS,
    })
    const alone = await Promise.all(
      KEYS.map((key) => countFacet(db, { params, scope, key }))
    )
    expect(together.map(byValue)).toEqual(alone.map(byValue))
    expect(together.some((rows) => rows.length > 0)).toBe(true)
    // The total is what a count query of the search itself gives, when the pass made one.
    if (total !== undefined)
      expect(total).toBe(await db.$count(listings, searchWhere(params, scope)))
  })
})
