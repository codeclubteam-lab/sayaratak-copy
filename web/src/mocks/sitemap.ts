import { TYPE_SLUGS } from "@/features/search/landing"
import { intentSchema } from "@sayaratak/shared/schemas/listing"
import type { SitemapEntry } from "@/lib/sitemap"
import { db } from "./db"
import { listed } from "./lib"
import { isPublic } from "./search"

const staticPages = [
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

// Everything A6 marks as indexed: static pages, every type and intent landing plus each city that has a vehicle for it, available approved listings, active profiles. `/search` and `/map` are noindex, so they stay out.
export function sitemapEntries(): SitemapEntry[] {
  const listings = db.listings.filter(
    (l) => isPublic(l) && l.status === "available"
  )
  const landings = Object.entries(TYPE_SLUGS).flatMap(([slug, type]) =>
    intentSchema.options.flatMap((intent) => {
      const cities = new Set(
        listings
          .filter(
            (l) =>
              l.kind === "vehicle" &&
              l.vehicleType === type &&
              l.intent === intent
          )
          .map((l) => l.cityId)
      )
      return [undefined, ...cities].map((city) => ({
        path: `/vehicles/${slug}/${intent}${city ? `/${city}` : ""}`,
      }))
    })
  )
  const profiles = (
    [
      ["dealerships", db.dealerships],
      ["workshops", db.workshops],
      ["mechanics", db.mechanics],
    ] as const
  ).flatMap(([dir, rows]) =>
    rows.filter(listed).map((r) => ({ path: `/${dir}/${r.slug}` }))
  )
  return [
    ...staticPages.map((path) => ({ path })),
    ...landings,
    ...listings.map((l) => ({
      path: `/listing/${l.slug}`,
      lastmod: l.updatedAt,
    })),
    ...profiles,
  ]
}
