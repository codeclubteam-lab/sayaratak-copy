import { usePrefs } from "@/lib/prefs"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ListingCard } from "./listing-card"

// The view comes from the saved preference unless the page passes one. `eager` is how many first photos load at once; `sidebar` is for a page with a filter panel beside it, which leaves room for three columns until xl.
export function ListingGrid({
  listings,
  view,
  eager = 0,
  sidebar = false,
}: {
  listings: Listing[]
  view?: "grid" | "row"
  eager?: number
  sidebar?: boolean
}) {
  const { listingView } = usePrefs()
  const row = (view ?? listingView) === "row"
  return (
    <ul
      className={
        row
          ? "grid grid-cols-1 gap-3 md:grid-cols-2"
          : sidebar
            ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
            : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
      }
    >
      {listings.map((listing, i) => (
        <li key={listing.id} className="*:h-full">
          <ListingCard
            listing={listing}
            variant={row ? "row" : "grid"}
            priority={i < eager}
          />
        </li>
      ))}
    </ul>
  )
}
