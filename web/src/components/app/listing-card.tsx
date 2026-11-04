import { Link } from "@tanstack/react-router"

import { useCityName } from "@/hooks/use-city-name"
import { useListingTitle } from "@/hooks/use-listing-title"
import { formatMileage } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cardSizes } from "@/lib/media"
import { markSharedCover } from "@/lib/motion"
import { useNow } from "@/lib/now"
import { isFeatured } from "@/lib/promotion"
import { cn } from "@/lib/utils"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { FavoriteButton } from "./favorite-button"
import { MediaImage } from "./media-image"
import { PriceText } from "./price-text"
import { PromotedBadge } from "./promoted-badge"
import { RelativeTime } from "./relative-time"
import { StatusBadge } from "./status-badge"
import { VerifiedBadge } from "./verified-badge"

// "grid" is the card in rails and result grids, "row" is the mobile result list.
// The title link is stretched over the whole card, so the heart stays a separate button.
export function ListingCard({
  listing,
  variant = "grid",
  preview = false,
  priority = false,
}: {
  listing: Listing
  variant?: "grid" | "row"
  // A draft that is not published yet: no heart and no link, since neither has a target.
  preview?: boolean
  // The photo loads at once and never fades (first row of a page).
  priority?: boolean
}) {
  const { t, locale } = useT()
  const now = useNow()
  const city = useCityName(listing.cityId)
  const title = useListingTitle()(listing)
  const promoted = isFeatured(listing.promotions, now)
  const first = listing.media[0]
  const facts =
    listing.kind === "part"
      ? [t(`condition.${listing.condition}`)]
      : [
          listing.year?.toString(),
          listing.mileageKm == null
            ? null
            : formatMileage(listing.mileageKm, locale),
          listing.fuel && t(`fuel.${listing.fuel}`),
        ].filter(Boolean)
  const row = variant === "row"
  return (
    <article
      className={cn(
        "group relative flex rounded-xl bg-card p-2",
        row ? "gap-3" : "flex-col gap-2"
      )}
    >
      <div
        className={cn(
          "relative transition-opacity group-has-[a:active]:opacity-92",
          row && "w-30 shrink-0"
        )}
      >
        <MediaImage
          src={first?.type === "video" ? first.posterUrl : (first?.url ?? null)}
          alt=""
          priority={priority}
          placeholderColor={first?.placeholderColor}
          sizes={row ? "120px" : cardSizes}
          className={row ? "aspect-square" : undefined}
        />
        <div className="absolute start-2 end-12 top-2 flex flex-wrap gap-1">
          {promoted && <PromotedBadge />}
          {listing.owner.verified && (
            <span className="rounded-full bg-card">
              <VerifiedBadge />
            </span>
          )}
          {listing.status !== "available" && (
            <span className="rounded-full bg-card">
              <StatusBadge status={listing.status} />
            </span>
          )}
        </div>
        {!preview && (
          <FavoriteButton
            listingId={listing.id}
            className="absolute end-1 top-1 z-10"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-1 pb-1">
        <PriceText price={listing.price} period={listing.rentPeriod} />
        <h3 className="min-h-[2lh] text-ui font-medium">
          {preview ? (
            <span className="line-clamp-2">
              <bdi>{title}</bdi>
            </span>
          ) : (
            <Link
              to="/$locale/listing/$slug"
              params={{ locale, slug: listing.slug }}
              onClick={(e) =>
                markSharedCover(
                  e.currentTarget
                    .closest("article")
                    ?.querySelector("[data-media]")
                )
              }
              className="line-clamp-2 underline decoration-transparent motion-color group-hover:decoration-current after:absolute after:inset-0"
            >
              <bdi>{title}</bdi>
            </Link>
          )}
        </h3>
        <p className="flex flex-wrap gap-x-3 text-caption text-muted-foreground">
          {facts.map((fact) => (
            <span key={fact} className="num">
              {fact}
            </span>
          ))}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-caption text-muted-foreground">
          <span className="truncate">{city}</span>
          <RelativeTime iso={listing.createdAt} className="shrink-0" />
        </div>
      </div>
    </article>
  )
}
