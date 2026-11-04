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
import { directoryQueries } from "./queries"
import type { WorkshopProfileSearch, WorkshopSearch } from "./workshop-schemas"

type Context = { queryClient: QueryClient; locale: Locale }

// Directory pages are 24 per page.
export const workshopFilters = (s: WorkshopSearch) => ({ ...s, limit: 24 })

export async function workshopsLoader(
  { queryClient, locale }: Context,
  search: WorkshopSearch,
  cause: string
) {
  const [title, description] = await getCopy({
    data: {
      locale,
      keys: ["nav.workshops", "directory.workshops_description"],
    },
  })
  await Promise.all([
    queryClient.ensureQueryData(taxonomyQuery),
    queryClient.prefetchQuery(bannersQuery("directory_top")),
    queryClient.prefetchQuery(adsQueries.serve("directory_workshops")),
    firstLoad(
      queryClient,
      directoryQueries.workshops.list(workshopFilters(search)),
      cause
    ),
  ])
  return { locale, title: title ?? "", description: description ?? "" }
}

// 404 from the API (missing or suspended) is the not-found page. The taxonomy is awaited so the server HTML has the city.
export async function workshopLoader(
  { queryClient, locale }: Context,
  slug: string,
  search: WorkshopProfileSearch,
  cause: string
) {
  const [w, tax] = await Promise.all([
    queryClient
      .ensureQueryData(directoryQueries.workshops.detail(slug))
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
      reviewQueries.list("workshop", w.id, { page: 1 }),
      cause
    )
  const city = tax.cities.find((c) => c.id === w.cityId)?.name[locale]
  const name = w.name[locale] || w.name.ar
  const cover = w.coverUrl || w.images[0]?.url
  return {
    locale,
    slug: w.slug,
    unavailable: w.unavailable,
    title: [name, city].filter(Boolean).join(", "),
    description: (w.description[locale] || w.description.ar)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 155),
    image: cover ? mediaSrc(cover, 1280) : undefined,
  }
}
