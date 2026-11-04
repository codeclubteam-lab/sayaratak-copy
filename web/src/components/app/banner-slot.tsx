import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import { cn } from "@/lib/utils"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { adsQueries } from "@/features/ads/queries"
import { bannersQuery } from "@/features/pages/queries"
import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import { Skeleton } from "@/components/ui/skeleton"
import { BannerItem } from "./banner-item"
import { HeroBanners } from "./hero-banners"
import { SectionError } from "./section-error"

// `variant="hero"` is the home carousel: every banner of the slot, tall, at the top of the home page. `ad` names the page whose paid banner (one running campaign, picked by the server) comes first: in the hero as the first slide, in a strip in place of the house banners, which only fill an unsold slot.
export function BannerSlot({
  placement,
  ad,
  variant = "strip",
}: {
  placement: Banner["placement"]
  ad?: AdPageId
  variant?: "strip" | "hero"
}) {
  const { t } = useT()
  const house = useQuery(bannersQuery(placement))
  const paid = useQuery({ ...adsQueries.serve(ad ?? ""), enabled: !!ad })
  const isPending = house.isPending || (!!ad && paid.isPending)
  const isError = house.isError
  const refetch = house.refetch
  const sold = paid.data ?? []
  const data =
    variant === "hero"
      ? [...sold, ...(house.data ?? [])]
      : sold.length
        ? sold
        : (house.data ?? [])
  const delayed = useDelayedFlag(isPending)
  if (isPending)
    return delayed ? (
      <Skeleton
        role="status"
        aria-label={t("nav.loading_advertisement")}
        className={cn(
          "w-full",
          variant === "hero"
            ? "aspect-[2/1] rounded-xl md:aspect-[3/1] md:rounded-xl"
            : "h-24 rounded-xl md:h-36"
        )}
      />
    ) : null
  if (isError)
    return (
      <SectionError
        message={t("nav.banner_error")}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  if (!data.length) return null
  if (variant === "hero") return <HeroBanners banners={data} />
  return (
    <aside aria-label={t("nav.advertisement")} className="space-y-4">
      {data.map((banner) => (
        <BannerItem key={banner.id} banner={banner} />
      ))}
    </aside>
  )
}
