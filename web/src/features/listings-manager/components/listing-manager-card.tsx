import { PriceText } from "@/components/app/price-text"
import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ListingCell } from "./listing-cell"
import { ListingRowActions, type ListingActions } from "./listing-row-actions"
import { ListingStatusSelect } from "./listing-status-select"
import { ReviewBadge } from "./review-badge"

// One listing as a card, for the table below md. The rejection reason is plain text here, because a tooltip cannot be opened by touch.
export function ListingManagerCard({
  listing,
  actions,
  onAnalytics,
  onPromote,
}: {
  listing: Listing
  actions: ListingActions
  onAnalytics: (listing: Listing) => void
  onPromote: (listing: Listing) => void
}) {
  const { t, locale } = useT()
  const { views, favorites, phoneClicks, whatsappClicks } = listing.stats
  return (
    <article className="flex flex-col gap-3 border-b p-3 in-[li:last-child]:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <ListingCell listing={listing} />
        <ListingRowActions
          listing={listing}
          actions={actions}
          onAnalytics={onAnalytics}
          onPromote={onPromote}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PriceText
          price={listing.price}
          period={listing.rentPeriod}
          size="table"
        />
        <ListingStatusSelect
          listing={listing}
          onChange={(next) => actions.setStatus(listing, next)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ReviewBadge listing={listing} />
        {listing.moderation === "rejected" && (
          <p className="text-caption text-muted-foreground">
            {listing.rejectionReason
              ? t("manager.reason", { reason: listing.rejectionReason })
              : t("manager.no_reason")}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-caption text-muted-foreground sm:grid-cols-4">
        {(
          [
            ["views", views],
            ["favorites", favorites],
            ["contacts", phoneClicks + whatsappClicks],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <dt>{t(`manager.col_${key}`)}</dt>
            <dd className="text-ui text-foreground num">
              {formatNumber(value, locale)}
            </dd>
          </div>
        ))}
        <div className="flex flex-col">
          <dt>{t("manager.col_expires")}</dt>
          <dd className="text-ui text-foreground">
            {formatDate(listing.expiresAt, locale)}
          </dd>
        </div>
      </dl>
    </article>
  )
}
