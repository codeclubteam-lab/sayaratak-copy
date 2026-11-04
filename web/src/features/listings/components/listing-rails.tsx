import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { ListingRail } from "@/components/app/listing-rail"
import { GridCard } from "@/components/app/page-skeleton"
import { listingQueries } from "../queries"
import { sellerHref, similarHref } from "../links"

// A rail that leaves no gap while it has nothing to show: a static skeleton row after 150 ms of loading, nothing when empty or failed.
function Rail({
  title,
  href,
  listings,
  pending,
}: {
  title: string
  href: string
  listings: Listing[] | undefined
  pending: boolean
}) {
  const { t } = useT()
  const showSkeleton = useDelayedFlag(pending, { delayMs: 150, minMs: 300 })
  if (showSkeleton)
    return (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <GridCard key={i} />
        ))}
      </div>
    )
  if (pending || !listings?.length) return null
  return <ListingRail title={title} href={href} listings={listings} />
}

export function ListingRails({ listing }: { listing: Listing }) {
  const { t } = useT()
  const similar = useQuery(listingQueries.similar(listing.id))
  const seller = useQuery(
    listingQueries.rail(
      { kind: listing.kind, seller: listing.owner.id },
      8,
      listing.id
    )
  )
  return (
    <>
      <Rail
        title={t("listing.similar")}
        href={similarHref(listing)}
        listings={similar.data}
        pending={similar.isPending}
      />
      <Rail
        title={t("listing.more_from_seller")}
        href={sellerHref(listing)}
        listings={seller.data?.items}
        pending={seller.isPending}
      />
    </>
  )
}
