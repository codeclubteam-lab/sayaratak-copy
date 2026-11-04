import { MapPinIcon } from "lucide-react"

import { useCityName } from "@/hooks/use-city-name"
import { useDistrictName } from "@/hooks/use-district-name"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { isFeatured } from "@/lib/promotion"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { CopyButton } from "@/components/app/copy-button"
import { FavoriteButton } from "@/components/app/favorite-button"
import { MakeLogo } from "@/components/app/make-logo"
import { PriceText } from "@/components/app/price-text"
import { PromotedBadge } from "@/components/app/promoted-badge"
import { RelativeTime } from "@/components/app/relative-time"
import { ReportDialog } from "@/components/app/report-dialog"
import { ShareMenu } from "@/components/app/share-menu"

// Title with the three actions at its end, then price, then where and when. The owner gets Share only: saving or reporting one's own listing means nothing.
export function TitleBlock({
  listing,
  title,
  own,
}: {
  listing: Listing
  title: string
  own: boolean
}) {
  const { t } = useT()
  const now = useNow()
  const city = useCityName(listing.cityId)
  const district = useDistrictName(listing.districtId)
  const promoted = isFeatured(listing.promotions, now)
  const code = listing.id.toUpperCase()
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h1
          tabIndex={-1}
          className="flex min-w-0 flex-1 basis-72 items-center gap-3 text-page font-semibold [text-wrap:balance] outline-none"
        >
          <MakeLogo id={listing.makeId} size="md" />
          <bdi>{title}</bdi>
        </h1>
        <div className="-ms-2 flex shrink-0 items-center md:ms-0">
          {!own && <FavoriteButton listingId={listing.id} variant="plain" />}
          <ShareMenu listing={listing} title={title} />
          {!own && <ReportDialog listingId={listing.id} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PriceText
          price={listing.price}
          period={listing.rentPeriod}
          size="detail"
        />
        {listing.negotiable && (
          <span className="text-ui text-muted-foreground">
            {t("listing.negotiable")}
          </span>
        )}
        {promoted && <PromotedBadge />}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ui text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPinIcon aria-hidden="true" strokeWidth={1.5} className="size-4" />
          {[district, city].filter(Boolean).join(", ")}
        </span>
        <span>
          {t("listing.posted")} <RelativeTime iso={listing.createdAt} />
        </span>
        <span className="inline-flex items-center">
          {t("listing.id_label")}{" "}
          <bdi dir="ltr" className="ms-1 num">
            {code}
          </bdi>
          <CopyButton value={code} label={t("listing.copy_id")} />
        </span>
      </div>
    </header>
  )
}
