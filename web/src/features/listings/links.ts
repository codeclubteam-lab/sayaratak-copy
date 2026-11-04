import { routeHref, searchRoute } from "@/features/search/landing"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// A dealership has its profile page; a private seller's other listings are a search on the owner id. Paths without the locale.
export const sellerHref = (l: Listing) =>
  l.owner.profileSlug
    ? `/dealerships/${l.owner.profileSlug}`
    : routeHref(
        searchRoute(
          searchParamsSchema.parse({ kind: l.kind, seller: l.owner.id })
        )
      )

// "See all" of the similar rail: the preset page for the same kind, type and intent.
export const similarHref = (l: Listing) =>
  routeHref(
    searchRoute(
      searchParamsSchema.parse({
        kind: l.kind,
        type: l.vehicleType ?? undefined,
        intent: l.kind === "vehicle" ? l.intent : undefined,
      })
    )
  )
