import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { and, count, isNotNull, type SQL, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  type FacetKey,
  type SearchScope,
  searchWhere,
} from "./listings.filters.queries"
import { listings } from "./listings.tables"

type Facet = { params: SearchParams; scope: SearchScope; key: FacetKey }
type Counts = { value: string; count: number }[]

const FACET_COLUMNS = {
  type: listings.vehicleType,
  make: listings.makeId,
  fuel: listings.fuel,
  transmission: listings.transmission,
  city: listings.cityId,
}

/** Counts per value of one facet, with that facet's own filter left out (disjunctive). */
export async function countFacet(ex: Executor, facet: Facet) {
  const where = searchWhere(facet.params, facet.scope, facet.key)
  if (facet.key === "type" && facet.params.kind === "part")
    return countFits(ex, where)
  const value = FACET_COLUMNS[facet.key]
  return ex
    .select({ value: sql<string>`${value}`, count: count() })
    .from(listings)
    .where(and(where, isNotNull(value)))
    .groupBy(value)
}

/**
 * The counts of several facets, in the order of `keys`, and how many rows the search matches
 * (undefined when no facet was counted in the shared pass). A facet leaves out its own filter, so a
 * facet whose filter is not set reads the same rows as the search itself: those are counted in one
 * pass over the rows (`grouping sets`) instead of one pass each, which took five scans of the
 * public listings and most of a search's database time at 50,000 listings (10.6).
 */
export async function countFacets(
  ex: Executor,
  find: Omit<Facet, "key"> & { keys: FacetKey[] }
) {
  const { keys, ...rest } = find
  const shared = keys.filter((key) => !isOwnFilterSet(rest.params, key))
  const [together, ...alone] = await Promise.all([
    countTogether(ex, { ...rest, keys: shared }),
    ...keys
      .filter((key) => !shared.includes(key))
      .map((key) => countFacet(ex, { ...rest, key })),
  ])
  const own = keys.filter((key) => !shared.includes(key))
  return {
    counts: keys.map(
      (key) =>
        together.counts.get(key) ?? alone[own.indexOf(key)] ?? ([] as Counts)
    ),
    total: together.total,
  }
}

// Whether the search itself already leaves this facet's values out (mock `skips`). A part's "type"
// facet counts compatible types, which a group-by cannot, so it is counted on its own.
function isOwnFilterSet(p: SearchParams, key: FacetKey) {
  const set = {
    type: p.type || p.kind === "part",
    make: p.make || p.model,
    fuel: p.fuel?.length,
    transmission: p.transmission?.length,
    city: p.city || p.district,
  }
  return Boolean(set[key])
}

// `grouping(a, b, c)` is a bit string, first column highest, with a 1 for every column that is
// not in the row's set: the set of column j alone reads (2^n - 1) minus that column's bit.
async function countTogether(
  ex: Executor,
  find: Omit<Facet, "key"> & { keys: FacetKey[] }
) {
  const result = new Map<FacetKey, Counts>()
  const { keys } = find
  if (keys.length === 0) return { counts: result, total: undefined }
  const columns = keys.map((key) => FACET_COLUMNS[key])
  // Every key is selected so a row reads the same whichever facets are counted together.
  const value = (key: FacetKey) =>
    keys.includes(key)
      ? sql<string | null>`${FACET_COLUMNS[key]}::text`
      : sql<string | null>`null::text`
  const rows = await ex
    .select({
      type: value("type"),
      make: value("make"),
      fuel: value("fuel"),
      transmission: value("transmission"),
      city: value("city"),
      set: sql<number>`grouping(${sql.join(columns, sql`, `)})`.mapWith(Number),
      count: count(),
    })
    .from(listings)
    .where(searchWhere(find.params, find.scope))
    .groupBy(
      sql`grouping sets (${sql.join(
        [...columns.map((column) => sql`(${column})`), sql`()`],
        sql`, `
      )})`
    )
  const all = 2 ** keys.length - 1
  for (const [index, key] of keys.entries()) {
    const mask = all - 2 ** (keys.length - 1 - index)
    result.set(
      key,
      rows.flatMap((row) => {
        const value = row[key]
        return row.set === mask && value !== null && value !== undefined
          ? [{ value, count: row.count }]
          : []
      })
    )
  }
  // The empty grouping set is the whole match: every column reads as not grouped.
  return { counts: result, total: rows.find((row) => row.set === all)?.count }
}

// A part counts once for each type it fits. Counted here, not in SQL:
// unnest cannot sit in a WHERE, and parts fit at most five types.
async function countFits(ex: Executor, where: SQL | undefined) {
  const rows = await ex
    .select({ types: listings.compatibleTypes })
    .from(listings)
    .where(where)
  const counts = new Map<string, number>()
  for (const type of rows.flatMap((row) => row.types))
    counts.set(type, (counts.get(type) ?? 0) + 1)
  return [...counts].map(([value, total]) => ({ value, count: total }))
}
