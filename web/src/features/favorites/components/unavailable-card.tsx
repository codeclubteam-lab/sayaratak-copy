import { MediaImage } from "@/components/app/media-image"
import { RemoveButton } from "@/components/app/remove-button"
import { StatusBadge } from "@/components/app/status-badge"
import { useListingTitle } from "@/hooks/use-listing-title"
import { useT } from "@/lib/i18n/use-t"
import { cardSizes } from "@/lib/media"
import type { FavoriteListing } from "@sayaratak/shared/schemas/listing"

// A saved listing that cannot be opened any more. Same shape as a `ListingCard` so rows line up: the photo grayed out with the Sold or Rented badge, the title, why, and a Remove button. No link.
export function UnavailableCard({
  listing,
  onRemove,
}: {
  listing: FavoriteListing
  onRemove: () => void
}) {
  const { t } = useT()
  const title = useListingTitle()(listing)
  const first = listing.media[0]
  return (
    <article className="flex flex-col gap-2 rounded-xl bg-card p-2">
      <div className="relative">
        <div className="opacity-60 grayscale">
          <MediaImage
            src={
              first?.type === "video" ? first.posterUrl : (first?.url ?? null)
            }
            alt=""
            placeholderColor={first?.placeholderColor}
            sizes={cardSizes}
          />
        </div>
        {(listing.status === "sold" || listing.status === "rented") && (
          <span className="absolute start-2 top-2 rounded-full bg-card">
            <StatusBadge status={listing.status} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-start gap-1 px-1 pb-1">
        <h3 className="line-clamp-2 min-h-[2lh] text-ui font-medium text-muted-foreground">
          <bdi>{title}</bdi>
        </h3>
        <p className="text-caption text-muted-foreground">
          {t("dashboard.favorites_unavailable")}
        </p>
        <RemoveButton
          variant="outline"
          className="mt-auto"
          title={t("dashboard.favorites_remove_title")}
          onConfirm={onRemove}
        >
          {t("common.remove")}
        </RemoveButton>
      </div>
    </article>
  )
}
