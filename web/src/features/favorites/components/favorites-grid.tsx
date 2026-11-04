import { ListingCard } from "@/components/app/listing-card"
import { useFavoriteActions } from "@/features/listings/favorite-actions"
import type { FavoriteListing } from "@sayaratak/shared/schemas/listing"
import { UnavailableCard } from "./unavailable-card"

// Same columns as the result grids that sit beside a panel. The heart on a card removes it; an unavailable listing has a Remove button instead.
export function FavoritesGrid({ items }: { items: FavoriteListing[] }) {
  const { remove } = useFavoriteActions()
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((listing, i) => (
        <li key={listing.id} className="*:h-full">
          {listing.unavailable ? (
            <UnavailableCard
              listing={listing}
              onRemove={() => remove(listing.id)}
            />
          ) : (
            <ListingCard listing={listing} priority={i < 4} />
          )}
        </li>
      ))}
    </ul>
  )
}
