import type { SearchParams } from "@sayaratak/shared/search/schemas"
import {
  and,
  asc,
  between,
  desc,
  inArray,
  ne,
  type SQL,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import type { Box } from "~/shared/geo/box"

import {
  distanceKm,
  type SearchScope,
  searchWhere,
} from "./listings.filters.queries"
import { listings } from "./listings.tables"

// A bump puts a listing back at the top as if it had just been posted.
export const posted = sql`coalesce(${listings.bumpedAt}, ${listings.createdAt})`

/**
 * How many rows match: the number the facet pass already counted (`known`, unset or undefined
 * when that pass could not), else a count query of its own.
 */
export async function totalOf(
  ex: Executor,
  where: SQL | undefined,
  known?: Promise<number | undefined>
) {
  return (await known) ?? ex.$count(listings, where)
}

/**
 * One page of a public search with the total. Ties keep id order, which is
 * the mock's array order for the seed (a stable JS sort). The total is not a window count
 * (`count(*) over ()`): that carries every wide matching row through a window, 64 ms for a deep
 * page at 50,000 listings, where the page alone reads an index and stops (10.6).
 */
export async function listSearchPage(
  ex: Executor,
  search: {
    params: SearchParams
    scope: SearchScope
    exclude?: string
    page: { offset: number; size: number }
    total?: Promise<number | undefined>
  }
) {
  const where = whereOf(search)
  const [rows, total] = await Promise.all([
    ex
      .select()
      .from(listings)
      .where(where)
      .orderBy(...orderOf(search.params), asc(listings.id))
      .offset(search.page.offset)
      .limit(search.page.size),
    totalOf(ex, where, search.total),
  ])
  return { rows, total }
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

export function whereOf(search: {
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
