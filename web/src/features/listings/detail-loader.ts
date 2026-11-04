import type { QueryClient } from "@tanstack/react-query"
import { notFound, redirect } from "@tanstack/react-router"

import { adsQueries } from "@/features/ads/queries"
import { bannersQuery } from "@/features/pages/queries"
import { ApiError } from "@/lib/api/client"
import { listingTitle } from "@/lib/listing-title"
import { mediaSrc } from "@/lib/media"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { formatPrice } from "@/lib/format"
import { listingQueries, taxonomyQuery } from "./queries"

// 404 from the API (missing, or not visible to this person) is the not-found page with a 404 status; a stale slug redirects to the canonical one. The taxonomy is awaited so the server HTML has the built title and city. The rails are prefetched for the server render only, so a client navigation never waits for them.
export async function listingLoader(
  { queryClient, locale }: { queryClient: QueryClient; locale: Locale },
  slug: string
) {
  const detail = listingQueries.detail(slug)
  const [listing, tax] = await Promise.all([
    queryClient.ensureQueryData(detail).catch((error: unknown) => {
      throw error instanceof ApiError && error.status === 404
        ? notFound()
        : error
    }),
    queryClient.ensureQueryData(taxonomyQuery),
  ])
  if (listing.slug !== slug) {
    throw redirect({
      to: "/$locale/listing/$slug",
      params: { locale, slug: listing.slug },
      statusCode: 301,
    })
  }
  const rails = Promise.allSettled([
    queryClient.prefetchQuery(bannersQuery("listing_aside")),
    queryClient.prefetchQuery(adsQueries.serve("listing_detail")),
    queryClient.prefetchQuery(listingQueries.similar(listing.id)),
    queryClient.prefetchQuery(
      listingQueries.rail(
        { kind: listing.kind, seller: listing.owner.id },
        8,
        listing.id
      )
    ),
  ])
  if (typeof window === "undefined") await rails

  const title = listingTitle(listing, tax, locale)
  const city = tax.cities.find((c) => c.id === listing.cityId)?.name[locale]
  const { amount, unit } = formatPrice(listing.price, locale)
  const cover = listing.media[0]
  const coverUrl = cover?.type === "video" ? cover.posterUrl : cover?.url
  return {
    locale,
    slug: listing.slug,
    title: [title, city].filter(Boolean).join(", "),
    description:
      (listing.description[locale] || listing.description.ar)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 155) || `${title} - ${amount} ${unit}`,
    image: coverUrl ? mediaSrc(coverUrl, 1280) : undefined,
    // Anything other than a live, available listing stays out of search results (A4).
    noindex:
      listing.moderation !== "approved" || listing.status !== "available",
  }
}
