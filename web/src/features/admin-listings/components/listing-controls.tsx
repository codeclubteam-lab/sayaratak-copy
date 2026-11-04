import type { ReactNode } from "react"

import { SelectInput } from "@/components/app/select-input"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { AdminListing } from "@sayaratak/shared/schemas/admin"
import {
  listingStatusSchema,
  type ListingStatus,
} from "@sayaratak/shared/schemas/listing"
import { PromotionBadge } from "@/features/listings-manager/components/promotion-badge"
import { ReviewBadge } from "@/features/listings-manager/components/review-badge"

// The top of the listing sheet: the states the admin can change, the promotion and links. Status saves on pick.
export function ListingControls({
  listing,
  onStatus,
  onGrant,
}: {
  listing: AdminListing
  onStatus: (status: ListingStatus) => void
  onGrant: () => void
}) {
  const { t, locale } = useT()
  const fact = (label: string, value: ReactNode) => (
    <div className="flex flex-col items-start gap-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-ui">{value}</dd>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4">
        {fact(t("manager.col_review"), <ReviewBadge listing={listing} />)}
        {fact(
          t("manager.col_status"),
          <SelectInput
            className="w-36"
            aria-label={t("manager.col_status")}
            value={listing.status}
            options={listingStatusSchema.options.map((s) => ({
              value: s,
              label: t(`status.${s}`),
            }))}
            onChange={(next) => onStatus(listingStatusSchema.parse(next))}
          />
        )}
        {fact(t("manager.col_promotion"), <PromotionBadge listing={listing} />)}
        {fact(
          t("dashboard.nav_reports"),
          <span className="num">{formatNumber(listing.reports, locale)}</span>
        )}
      </dl>
      {listing.rejectionReason && listing.moderation === "rejected" && (
        <p className="text-ui">
          {t("manager.reason", { reason: listing.rejectionReason })}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {listing.moderation === "approved" && (
          <Button type="button" variant="outline" onClick={onGrant}>
            {t("admin.grant")}
          </Button>
        )}
        <a
          href={localeHref(`/listing/${listing.slug}`, locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ui font-medium text-primary hover:underline"
        >
          {t("admin.open_public_page")}
        </a>
      </div>
    </div>
  )
}
