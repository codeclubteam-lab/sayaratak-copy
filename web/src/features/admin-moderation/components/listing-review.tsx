import type { ReactNode } from "react"

import { Gallery } from "@/components/app/gallery"
import { LocationBlock } from "@/components/app/location-block"
import { PriceText } from "@/components/app/price-text"
import { SpecsList } from "@/components/app/specs-list"
import { useDistrictName } from "@/hooks/use-district-name"
import { useListingTitle } from "@/hooks/use-listing-title"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { SellerPanel } from "@/features/admin/components/seller-panel"
import { Description } from "@/features/listings/components/description"
import { useListingFacts } from "@/features/listings/use-listing-facts"
import { useSpecGroups } from "@/features/listings/use-spec-groups"

const card = "flex flex-col gap-4 rounded-xl bg-card p-4 md:p-5"

// The listing as the admin judges it: photos, price, every filled spec, the description, the exact spot and who posted it. `actions` is the sticky bar at the bottom. The pane stays mounted from one listing to the next so focus survives J, K and A; the gallery and description restart per listing.
export function ListingReview({
  listing,
  actions,
}: {
  listing: Listing
  actions: ReactNode
}) {
  const { t, locale } = useT()
  const now = useNow()
  const title = useListingTitle()(listing)
  const district = useDistrictName(listing.districtId)
  const { specs } = useListingFacts(listing)
  const { groups } = useSpecGroups(listing, specs)
  const text = listing.description[locale] || listing.description.ar
  return (
    <article aria-labelledby="review-title" className="flex flex-col gap-4">
      <Gallery key={listing.id} items={listing.media} alt={title} />
      <div className={card}>
        <h2
          id="review-title"
          tabIndex={-1}
          className="text-title font-semibold outline-none"
        >
          <bdi>{title}</bdi>
        </h2>
        <PriceText
          price={listing.price}
          period={listing.rentPeriod}
          size="detail"
        />
        <p className="text-caption text-muted-foreground">
          {t("admin.submitted", {
            time: formatRelative(listing.createdAt, now, locale),
          })}
        </p>
      </div>
      {groups.length > 0 && (
        <section className={card}>
          <h3 className="text-ui font-semibold">{t("admin.specs")}</h3>
          {groups.map((g) => (
            <SpecsList key={g.id} items={g.items} />
          ))}
        </section>
      )}
      {text && (
        <section className={card}>
          <h3 className="text-ui font-semibold">
            {t("listing.description_title")}
          </h3>
          <Description key={listing.id} text={text} />
        </section>
      )}
      <section className={card}>
        <h3 className="text-ui font-semibold">{t("listing.location_title")}</h3>
        <LocationBlock
          cityId={listing.cityId}
          address={district}
          location={listing.location}
        />
      </section>
      <SellerPanel owner={listing.owner} />
      {actions}
    </article>
  )
}
