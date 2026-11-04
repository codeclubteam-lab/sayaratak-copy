import { intentSchema } from "@sayaratak/shared/schemas/listing"
import type { SitemapEntry } from "@sayaratak/shared/schemas/responses"
import { TYPE_SLUGS } from "@sayaratak/shared/search/landing"

import { db } from "~/shared/db/client"
import { listListedProfileSlugs } from "~/modules/businesses/businesses.sitemap.service"
import { listHiddenOwnerIds } from "~/modules/listings/listings.read.service"
import { listIndexableListings } from "~/modules/listings/listings.sitemap.service"

// Pages every visitor can open, without the locale prefix ("" is the home page).
const STATIC_PATHS = [
  "",
  "/dealerships",
  "/workshops",
  "/mechanics",
  "/parts",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
]

type IndexableListing = Awaited<
  ReturnType<typeof listIndexableListings>
>[number]

/**
 * `GET /sitemap`: every public page worth indexing. `/search` and `/map` are
 * noindex, so they stay out. Example: one available car for sale in Khartoum
 * adds `/vehicles/cars/sale`, `/vehicles/cars/sale/khartoum` and its own page.
 */
export async function getSitemap(): Promise<SitemapEntry[]> {
  const hiddenOwnerIds = await listHiddenOwnerIds(db)
  // Two independent reads.
  const [listings, profiles] = await Promise.all([
    listIndexableListings(hiddenOwnerIds),
    listListedProfileSlugs(hiddenOwnerIds),
  ])
  return [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...landingPaths(listings).map((path) => ({ path })),
    ...listings.map((row) => ({
      path: `/listing/${row.slug}`,
      lastmod: row.updatedAt.toISOString(),
    })),
    ...Object.entries(profiles).flatMap(([directory, slugs]) =>
      slugs.map((slug) => ({ path: `/${directory}/${slug}` }))
    ),
  ]
}

// Each vehicle type and intent has a landing page, plus one per city that has a vehicle for it.
function landingPaths(listings: IndexableListing[]) {
  return Object.entries(TYPE_SLUGS).flatMap(([slug, type]) =>
    intentSchema.options.flatMap((intent) => {
      const cities = new Set(
        listings
          .filter(
            (row) =>
              row.kind === "vehicle" &&
              row.vehicleType === type &&
              row.intent === intent
          )
          .map((row) => row.cityId)
      )
      const base = `/vehicles/${slug}/${intent}`
      return [base, ...[...cities].map((city) => `${base}/${city}`)]
    })
  )
}
