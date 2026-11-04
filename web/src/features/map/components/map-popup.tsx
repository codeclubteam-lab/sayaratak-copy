import { XIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { MapPoint } from "@sayaratak/shared/schemas/responses"
import { buttonVariants } from "@/components/ui/button"
import { PointSummary, pointPath } from "./point-summary"

// The content of a pin's popup. Leaflet's own close button is off, so this one has a name in the page's language. Leaflet colors every link in the map, hence the `!` on the button text.
export function MapPopup({
  point,
  onClose,
}: {
  point: MapPoint
  onClose: () => void
}) {
  const { t, locale } = useT()
  return (
    <div className="flex w-56 flex-col gap-3">
      <PointSummary point={point} />
      <div className="flex gap-2">
        <a
          href={localeHref(pointPath(point), locale)}
          className={buttonVariants({
            size: "sm",
            className: "flex-1 text-primary-foreground!",
          })}
        >
          {t("map.open")}
        </a>
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="grid size-9 place-items-center rounded-lg text-muted-foreground motion-color hover:bg-muted hover:text-foreground"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  )
}
