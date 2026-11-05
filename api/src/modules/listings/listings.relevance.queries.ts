import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { and, asc, desc, inArray, not, type SQL } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { hasMedia, type SearchScope } from "./listings.filters.queries"
import { posted, totalOf, whereOf } from "./listings.search.queries"
import { listings } from "./listings.tables"

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
    total?: Promise<number | undefined>
  }
) {
  const where = whereOf(search)
  const featured = inArray(listings.id, [...search.scope.featuredIds, ""])
  const ids = (filter: SQL | undefined, order: SQL[], limit?: number) => {
    const query = ex
      .select({ id: listings.id })
      .from(listings)
      .where(and(where, filter))
      .orderBy(...order)
      .$dynamic()
    return (limit === undefined ? query : query.limit(limit)).then((rows) =>
      rows.map((row) => row.id)
    )
  }
  // With photos first, then without, each newest first: the same order as sorting every match by
  // `hasMedia` then `posted`, but each half reads the `listings_posted` index and stops at the
  // limit, where one sort over every match took 120 ms at 50,000 listings (10.6).
  const organicIds = async () => {
    const order = [desc(posted), asc(listings.id)]
    const limit = search.organicLimit
    const withMedia = await ids(and(not(featured), hasMedia()), order, limit)
    if (withMedia.length >= limit) return withMedia
    const without = await ids(
      and(not(featured), not(hasMedia())),
      order,
      limit - withMedia.length
    )
    return [...withMedia, ...without]
  }
  const [paid, organic, total] = await Promise.all([
    ids(featured, [desc(hasMedia()), desc(posted), asc(listings.id)]),
    organicIds(),
    totalOf(ex, where, search.total),
  ])
  return { featured: paid, organic, total }
}
