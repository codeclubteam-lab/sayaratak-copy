import { StarIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { MapPoint } from "@sayaratak/shared/schemas/responses"
import { MediaImage } from "@/components/app/media-image"
import { PriceText } from "@/components/app/price-text"

const paths = {
  vehicle: "/listing",
  dealership: "/dealerships",
  workshop: "/workshops",
  mechanic: "/mechanics",
}
export const pointPath = (p: MapPoint) => `${paths[p.kind]}/${p.slug}`

// Photo, kind, name and price or rating: the one summary the list rows and the popup share.
export function PointSummary({ point: p }: { point: MapPoint }) {
  const { t, locale } = useT()
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MediaImage
        src={p.photoUrl}
        alt=""
        sizes="56px"
        fit={
          p.kind === "vehicle" || p.kind === "mechanic" ? "cover" : "contain"
        }
        className={`size-14 shrink-0 ${p.kind === "mechanic" ? "rounded-full" : "rounded-lg"}`}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-caption text-muted-foreground">
          {t(`map.kind_${p.kind}`)}
        </span>
        <bdi className="truncate text-ui font-medium">{p.title[locale]}</bdi>
        {p.price !== null && <PriceText price={p.price} size="table" />}
        {p.rating !== null && (
          <span className="inline-flex items-center gap-1">
            <StarIcon
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-4 fill-foreground"
            />
            <span className="text-caption num">{p.rating.toFixed(1)}</span>
          </span>
        )}
      </div>
    </div>
  )
}
