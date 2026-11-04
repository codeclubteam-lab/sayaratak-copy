import type { SearchParams } from "@sayaratak/shared/search/schemas"
import {
  and,
  asc,
  between,
  count,
  desc,
  inArray,
  isNotNull,
  ne,
  not,
  type SQL,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import type { Box } from "~/shared/geo/box"

import {
  distanceKm,
  type FacetKey,
  hasMedia,
  type SearchScope,
  searchWhere,
} from "./listings.filters.queries"
import { listings } from "./listings.tables"

const FACET_COLUMNS = {
  type: listings.vehicleType,
  make: listings.makeId,
  fuel: listings.fuel,
  transmission: listings.transmission,
  city: listings.cityId,
}
// A bump puts a listing back at the top as if it had just been posted.
const posted = sql`coalesce(${listings.bumpedAt}, ${listings.createdAt})`

/**
 * One page of a public search with the total. Ties keep id order, which is
 * the mock's array order for the seed (a stable JS sort).
 */
export async function listSearchPage(
  ex: Executor,
  search: {
    params: SearchParams
    scope: SearchScope
    exclude?: string
    page: { offset: number; size: number }
  }
) {
  const { params } = search
  const where = whereOf(search)
  const rows = await ex
    .select({
      listing: listings,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(listings)
    .where(where)
    .orderBy(...orderOf(params), asc(listings.id))
    .offset(search.page.offset)
    .limit(search.page.size)
  const total = rows[0]?.total ?? (await ex.$count(listings, where))
  return { rows: rows.map((row) => row.listing), total }
}

/**
 * Relevance (A11): every matching Featured id, and organic ids in ranking
 * order up to `organicLimit` (the page's last slot can need no more).
 * Featured keep ranking order too, so equal turns break ties as the mock.
 */
export async function listRelevanceIds(
  ex: Executor,
  search: {
    params: SearchParams
    scope: SearchScope
    exclude?: string
    organicLimit: number
  }
) {
  const where = whereOf(search)
  const featured = inArray(listings.id, [...search.scope.featuredIds, ""])
  const ids = (filter: SQL | undefined, limit?: number) => {
    const query = ex
      .select({ id: listings.id })
      .from(listings)
      .where(and(where, filter))
      .orderBy(desc(hasMedia()), desc(posted), asc(listings.id))
      .$dynamic()
    return (limit === undefined ? query : query.limit(limit)).then((rows) =>
      rows.map((row) => row.id)
    )
  }
  const [paid, organic, total] = await Promise.all([
    ids(featured),
    ids(not(featured), search.organicLimit),
    ex.$count(listings, where),
  ])
  return { featured: paid, organic, total }
}

/**
 * Map pins: matching listings with a pin inside the box, Featured first then
 * id order (the mock's stable sort by tier), at most `limit`, with the total.
 */
export async function listInBox(
  ex: Executor,
  find: { params: SearchParams; scope: SearchScope; box: Box; limit: number }
) {
  const { box } = find
  const rows = await ex
    .select({
      listing: listings,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(listings)
    .where(
      and(
        searchWhere(find.params, find.scope),
        between(listings.lat, box.south, box.north),
        between(listings.lng, box.west, box.east)
      )
    )
    .orderBy(
      desc(inArray(listings.id, [...find.scope.featuredIds, ""])),
      asc(listings.id)
    )
    .limit(find.limit)
  return { rows: rows.map((row) => row.listing), total: rows[0]?.total ?? 0 }
}

/** Listings by id, in the order of `ids`. */
export async function listByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return []
  const rows = await ex.select().from(listings).where(inArray(listings.id, ids))
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

/** Counts per value of one facet, with that facet's own filter left out (disjunctive). */
export async function countFacet(
  ex: Executor,
  facet: { params: SearchParams; scope: SearchScope; key: FacetKey }
) {
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

function whereOf(search: {
  params: SearchParams
  scope: SearchScope
  exclude?: string
}) {
  return and(
    searchWhere(search.params, search.scope),
    search.exclude ? ne(listings.id, search.exclude) : undefined
  )
}

// Mock `sortListings` for the explicit sorts; relevance goes through
// `listRelevanceIds` and `capPaid` instead.
function orderOf(params: SearchParams): SQL[] {
  const origin = originOf(params)
  const orders: Record<Exclude<SearchParams["sort"], "relevance">, SQL[]> = {
    newest: [desc(posted)],
    price_asc: [asc(listings.price)],
    price_desc: [desc(listings.price)],
    year_desc: [sql`coalesce(${listings.year}, 0) desc`],
    mileage_asc: [sql`coalesce(${listings.mileageKm}, 0) asc`],
    nearest: origin ? [sql`${distanceKm(origin)} asc nulls last`] : [],
  }
  return params.sort === "relevance" ? [] : orders[params.sort]
}

function originOf(params: SearchParams) {
  return params.lat !== undefined && params.lng !== undefined
    ? { lat: params.lat, lng: params.lng }
    : null
}

/** Relevance, or nearest without a point (the mock ranks both the same). */
export function isRelevance(params: SearchParams) {
  return (
    params.sort === "relevance" ||
    (params.sort === "nearest" && originOf(params) === null)
  )
}
