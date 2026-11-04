import { PriceText } from "@/components/app/price-text"
import { StatusBadge } from "@/components/app/status-badge"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminListing } from "@sayaratak/shared/schemas/admin"
import { ReviewBadge } from "@/features/listings-manager/components/review-badge"
import { AdminListingCell } from "./admin-listing-cell"

// One listing below md: the listing button, its states, then seller and when.
export function AdminListingCard({
  listing,
  onOpen,
}: {
  listing: AdminListing
  onOpen: () => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <AdminListingCell listing={listing} onOpen={onOpen} />
      <PriceText
        price={listing.price}
        period={listing.rentPeriod}
        size="table"
      />
      <div className="flex flex-wrap items-center gap-2">
        <ReviewBadge listing={listing} />
        <StatusBadge status={listing.status} />
      </div>
      {listing.reports > 0 && (
        <p className="text-caption">
          {t("admin.report_count", { count: listing.reports })}
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        <bdi>{listing.owner.name[locale]}</bdi>
        {" · "}
        {formatRelative(listing.createdAt, now, locale)}
      </p>
    </article>
  )
}
