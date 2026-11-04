import type { QueryClient } from "@tanstack/react-query"

import { adsQueries } from "@/features/ads/queries"
import { adPageOf } from "@/features/ads/ad-page-of"
import { listingQueries, taxonomyQuery } from "@/features/listings/queries"
import { bannersQuery } from "@/features/pages/queries"
import { getCopy } from "@/lib/i18n/server"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { fill, searchTitle, titleKeys } from "./title"

// First visit waits for the first page, so the server renders results. A filter, sort or page change on the same page does not: the old results stay and dim while the new ones load (A5b). The taxonomy is awaited either way, for the localized titles.
export async function searchLoader(
  { queryClient, locale }: { queryClient: QueryClient; locale: Locale },
  search: SearchParams,
  cause: string
) {
  const list = listingQueries.list(search)
  // A failed first page is dropped from the cache, so server and client both start from "loading" and the page shows its own error and retry.
  const first =
    cause === "stay"
      ? void queryClient.prefetchQuery(list)
      : queryClient
          .ensureQueryData(list)
          .catch(() => queryClient.removeQueries({ queryKey: list.queryKey }))
  const [tax, copy] = await Promise.all([
    queryClient.ensureQueryData(taxonomyQuery),
    getCopy({ data: { locale, keys: [...titleKeys] } }),
    queryClient.prefetchQuery(bannersQuery("search_top")),
    queryClient.prefetchQuery(adsQueries.serve(adPageOf(search))),
    first,
  ])
  const messages = Object.fromEntries(
    titleKeys.map((key, i) => [key, copy[i] ?? ""])
  )
  const t = (key: string, vars?: Record<string, string>) =>
    fill(messages[key] ?? "", vars)
  const title = searchTitle(search, tax, locale, t)
  return {
    locale,
    title,
    description: t("search.description", { title }),
  }
}
