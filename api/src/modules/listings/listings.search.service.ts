import type { SearchParams } from "@sayaratak/shared/search/schemas"

import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as promotions from "~/modules/promotions/promotions.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import {
  type FacetKey,
  matchesSearch,
  type SearchScope,
} from "./listings.filters.queries"
import { capPaid } from "./listings.ranking.service"
import { listHiddenOwnerIds } from "./listings.read.service"
import * as q from "./listings.search.queries"
import { toListings } from "./listings.view.service"

// A11: 24 a page; rails ask for 1 to 24 with `limit`.
const PAGE_SIZE = 24
const FACET_KEYS: FacetKey[] = ["type", "make", "fuel", "transmission", "city"]
const NO_IDS = Promise.resolve<string[]>([])

type Search = {
  viewer: SessionUser | null
  params: SearchParams
  /** Rails: a shorter page, and the listing the rail sits on left out. */
  limit?: string
  exclude?: string
}

/**
 * `GET /listings`: one page of public listings matching every filter, in the
 * chosen order, with facet counts. A page past the last is empty, not an error.
 */
export async function searchListings(search: Search) {
  const { params } = search
  const scope = await scopeOf(db, params)
  const size = pageSizeOf(search.limit)
  const window = { offset: (params.page - 1) * size, size }
  // The page and the five facet counts are independent reads.
  const [page, facets] = await Promise.all([
    q.isRelevance(params)
      ? relevancePage(db, { ...search, scope, window })
      : q.listSearchPage(db, {
          params,
          scope,
          exclude: search.exclude,
          page: window,
        }),
    facetsOf(db, params, scope),
  ])
  return {
    items: await toListings(db, page.rows, search.viewer),
    total: page.total,
    page: params.page,
    pageSize: size,
    facets,
  }
}

// A11: Featured and organic ids, interleaved by `capPaid`, then the page's rows by id.
async function relevancePage(
  ex: Executor,
  search: Search & {
    scope: SearchScope
    window: { offset: number; size: number }
  }
) {
  const { offset, size } = search.window
  const ids = await q.listRelevanceIds(ex, {
    params: search.params,
    scope: search.scope,
    exclude: search.exclude,
    organicLimit: offset + size,
  })
  const order = capPaid(ids.featured, ids.organic)
  const rows = await q.listByIds(ex, order.slice(offset, offset + size))
  return { rows, total: ids.total }
}

/** Whether the listing would show in the public search for these filters (A11), as the mock's `matches`. */
export async function listingMatchesSearch(
  ex: Executor,
  find: { id: string; params: SearchParams }
) {
  const scope = await scopeOf(ex, find.params)
  return matchesSearch(ex, { ...find, scope })
}

/** The id lists the filters need from other modules; each is read only when used. */
export async function scopeOf(
  ex: Executor,
  params: SearchParams
): Promise<SearchScope> {
  const [hiddenOwnerIds, featuredIds, userIds, dealershipOwnerIds, videoIds] =
    await Promise.all([
      listHiddenOwnerIds(ex),
      promotions.listFeaturedIds(ex),
      params.verifiedOnly ? auth.listPhoneVerifiedIds(ex) : NO_IDS,
      params.verifiedOnly
        ? businesses.listVerifiedDealershipOwnerIds(ex)
        : NO_IDS,
      params.hasVideo ? uploads.listVideoIds(ex) : NO_IDS,
    ])
  return {
    hiddenOwnerIds,
    featuredIds,
    verified: { userIds, dealershipOwnerIds },
    videoIds,
  }
}

// Disjunctive facets (A11): each counts with its own filter removed, so
// choosing Toyota still shows how many Nissans there are.
// Example: make=toyota&fuel=diesel counts makes over all diesel cars, fuels
// over all Toyotas. Sorted most first, then by value, as the mock.
async function facetsOf(
  ex: Executor,
  params: SearchParams,
  scope: SearchScope
) {
  const counts = await Promise.all(
    FACET_KEYS.map((key) => q.countFacet(ex, { params, scope, key }))
  )
  const sorted = counts.map((rows) =>
    rows
      .map((row) => ({ value: row.value, count: row.count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
  )
  const [type = [], make = [], fuel = [], transmission = [], city = []] = sorted
  return { type, make, fuel, transmission, city }
}

// Mock `pageParams`: `limit` 1 to 24 for rails, else the page of 24.
function pageSizeOf(limit: string | undefined) {
  const asked = Math.floor(Number(limit))
  if (!asked) return PAGE_SIZE
  return Math.min(PAGE_SIZE, Math.max(1, asked))
}
