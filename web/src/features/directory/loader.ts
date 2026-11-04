import type {
  FetchQueryOptions,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { adsQueries } from "@/features/ads/queries"
import { listingQueries, taxonomyQuery } from "@/features/listings/queries"
import { bannersQuery } from "@/features/pages/queries"
import { reviewQueries } from "@/features/reviews/queries"
import { ApiError } from "@/lib/api/client"
import { getCopy } from "@/lib/i18n/server"
import { mediaSrc } from "@/lib/media"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { directoryQueries } from "./queries"
import {
  inventorySearch,
  type DealershipProfileSearch,
  type DealershipSearch,
} from "./schemas"

type Context = { queryClient: QueryClient; locale: Locale }

// Directory pages are 24 per page.
export const dealershipFilters = (s: DealershipSearch) => ({ ...s, limit: 24 })

// A failed first load is dropped from the cache, so server and client both start from "loading" and the page shows its own error and retry. A filter or page change on the same page does not wait (the old cards dim instead).
export function firstLoad<T, TKey extends QueryKey>(
  queryClient: QueryClient,
  query: FetchQueryOptions<T, Error, T, TKey>,
  cause: string
) {
  return cause === "stay"
    ? void queryClient.prefetchQuery(query)
    : queryClient
        .ensureQueryData(query)
        .catch(() => queryClient.removeQueries({ queryKey: query.queryKey }))
}

export async function dealershipsLoader(
  { queryClient, locale }: Context,
  search: DealershipSearch,
  cause: string
) {
  const [title, description] = await getCopy({
    data: {
      locale,
      keys: ["nav.dealerships", "directory.dealerships_description"],
    },
  })
  await Promise.all([
    queryClient.prefetchQuery(bannersQuery("directory_top")),
    queryClient.prefetchQuery(adsQueries.serve("directory_dealerships")),
    firstLoad(
      queryClient,
      directoryQueries.dealerships.list(dealershipFilters(search)),
      cause
    ),
  ])
  return { locale, title: title ?? "", description: description ?? "" }
}

// 404 from the API (missing or suspended) is the not-found page. The taxonomy is awaited so the server HTML has the city; the open tab's data is prefetched too.
export async function dealershipLoader(
  { queryClient, locale }: Context,
  slug: string,
  search: DealershipProfileSearch,
  cause: string
) {
  const [d, tax] = await Promise.all([
    queryClient
      .ensureQueryData(directoryQueries.dealerships.detail(slug))
      .catch((error: unknown) => {
        throw error instanceof ApiError && error.status === 404
          ? notFound()
          : error
      }),
    queryClient.ensureQueryData(taxonomyQuery),
  ])
  if (search.tab === "inventory")
    await firstLoad(
      queryClient,
      listingQueries.list(inventorySearch(search, d.ownerId)),
      cause
    )
  if (search.tab === "reviews")
    await firstLoad(
      queryClient,
      reviewQueries.list("dealership", d.id, { page: 1 }),
      cause
    )
  const city = tax.cities.find((c) => c.id === d.cityId)?.name[locale]
  const name = d.name[locale] || d.name.ar
  return {
    locale,
    slug: d.slug,
    unavailable: d.unavailable,
    title: [name, city].filter(Boolean).join(", "),
    description: (d.description[locale] || d.description.ar)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 155),
    image: d.coverUrl ? mediaSrc(d.coverUrl, 1280) : undefined,
  }
}
