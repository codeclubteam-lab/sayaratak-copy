import { useCityName } from "@/hooks/use-city-name"
import { useListingTitle } from "@/hooks/use-listing-title"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ListingCard } from "./listing-card"
import { MediaImage } from "./media-image"
import { PriceText } from "./price-text"

// The card as the post wizard and the reports sheet show it, with no heart and no link. `compact` is one row.
export function ListingPreview({
  listing,
  compact = false,
}: {
  listing: Listing
  compact?: boolean
}) {
  const { t } = useT()
  const city = useCityName(listing.cityId)
  const title = useListingTitle()(listing)
  const first = listing.media[0]
  if (compact)
    return (
      <div className="flex items-center gap-3">
        <MediaImage
          src={first?.type === "video" ? first.posterUrl : (first?.url ?? null)}
          alt=""
          placeholderColor={first?.placeholderColor}
          sizes="64px"
          className="size-16 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-ui font-medium">
            <bdi>{title}</bdi>
          </span>
          <PriceText
            price={listing.price}
            period={listing.rentPeriod}
            size="table"
          />
          <span className="truncate text-caption text-muted-foreground">
            {city}
          </span>
        </div>
      </div>
    )
  const facts = [
    t(`condition.${listing.condition}`),
    listing.transmission && t(`transmission.${listing.transmission}`),
    listing.negotiable && t("form.preview_fact_negotiable"),
  ].filter((fact): fact is string => !!fact)
  return (
    <div className="flex flex-col gap-2">
      <ListingCard listing={listing} preview />
      <p className="flex flex-wrap gap-x-3 text-caption text-muted-foreground">
        {facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </p>
    </div>
  )
}
