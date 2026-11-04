import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { adsQueries } from "@/features/ads/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { bannersQuery } from "@/features/pages/queries"
import { reviewQueries } from "@/features/reviews/queries"
import { ApiError } from "@/lib/api/client"
import { getCopy } from "@/lib/i18n/server"
import { mediaSrc } from "@/lib/media"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { firstLoad } from "./loader"
import type { MechanicProfileSearch, MechanicSearch } from "./mechanic-schemas"
import { directoryQueries } from "./queries"

type Context = { queryClient: QueryClient; locale: Locale }

// Directory pages are 24 per page.
export const mechanicFilters = (s: MechanicSearch) => ({ ...s, limit: 24 })

export async function mechanicsLoader(
  { queryClient, locale }: Context,
  search: MechanicSearch,
  cause: string
) {
  const [title, description] = await getCopy({
    data: {
      locale,
      keys: ["nav.mechanics", "directory.mechanics_description"],
    },
  })
  await Promise.all([
    queryClient.ensureQueryData(taxonomyQuery),
    queryClient.prefetchQuery(bannersQuery("directory_top")),
    queryClient.prefetchQuery(adsQueries.serve("directory_mechanics")),
    firstLoad(
      queryClient,
      directoryQueries.mechanics.list(mechanicFilters(search)),
      cause
    ),
  ])
  return { locale, title: title ?? "", description: description ?? "" }
}

// 404 from the API (missing or suspended) is the not-found page. The taxonomy is awaited so the server HTML has the city and the specializations.
export async function mechanicLoader(
  { queryClient, locale }: Context,
  slug: string,
  search: MechanicProfileSearch,
  cause: string
) {
  const [m, tax] = await Promise.all([
    queryClient
      .ensureQueryData(directoryQueries.mechanics.detail(slug))
      .catch((error: unknown) => {
        throw error instanceof ApiError && error.status === 404
          ? notFound()
          : error
      }),
    queryClient.ensureQueryData(taxonomyQuery),
  ])
  if (search.tab === "reviews")
    await firstLoad(
      queryClient,
      reviewQueries.list("mechanic", m.id, { page: 1 }),
      cause
    )
  const city = tax.cities.find((c) => c.id === m.cityId)?.name[locale]
  const name = m.name[locale] || m.name.ar
  return {
    locale,
    slug: m.slug,
    unavailable: m.unavailable,
    title: [name, city].filter(Boolean).join(", "),
    description: (m.bio[locale] || m.bio.ar)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 155),
    image: m.photoUrl ? mediaSrc(m.photoUrl, 640) : undefined,
  }
}
