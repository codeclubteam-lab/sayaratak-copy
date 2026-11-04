import { directoryQueries } from "@/features/directory/queries"
import { listingQueries } from "@/features/listings/queries"
import type { Geo } from "@sayaratak/shared/schemas/fields"

const RAIL = 8

// One query per block. Rails ask for eight cards through `listingQueries.rail`; the directories take a `limit`.
export const homeQueries = {
  featured: listingQueries.rail({ featured: true }, RAIL),
  // Its facets give the five vehicle counts on the category tiles.
  newest: listingQueries.rail({ kind: "vehicle", sort: "newest" }, RAIL),
  rentals: listingQueries.rail({ type: "car", intent: "rent" }, RAIL),
  near: (center: Geo, radius: number) =>
    listingQueries.rail({ ...center, radius, sort: "nearest" }, RAIL),
  // Counted only: the Parts tile shows `total`.
  parts: listingQueries.rail({ kind: "part" }, 1),
  dealerships: directoryQueries.dealerships.list({
    verified: true,
    sort: "rating",
    limit: 6,
  }),
  workshops: directoryQueries.workshops.list({ sort: "rating", limit: 3 }),
  mechanics: directoryQueries.mechanics.list({ sort: "rating", limit: 3 }),
}
