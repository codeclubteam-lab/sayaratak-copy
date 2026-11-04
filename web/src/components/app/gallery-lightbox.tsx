import { useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { arrowStep } from "@/lib/media"
import { clamp, cn } from "@/lib/utils"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useDirection } from "@/components/ui/direction"
import { GallerySlide } from "./gallery-slide"

export type Captioned = Media & { caption?: string }

// `zoomable` (documents) adds a 2x zoom: the zoom button or a press on the photo toggles it, and the zoomed photo scrolls to pan.
export function GalleryLightbox({
  items,
  alt,
  index,
  onIndex,
  onClose,
  zoomable = false,
}: {
  items: Captioned[]
  alt: string
  index: number
  onIndex: (index: number) => void
  onClose: () => void
  zoomable?: boolean
}) {
  const { t } = useT()
  const dir = useDirection()
  const [zoomed, setZoomed] = useState(false)
  const last = items.length - 1
  const go = (to: number) => {
    setZoomed(false)
    onIndex(clamp(to, 0, last))
  }
  const item = items[index]
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        // Zoomed, the arrow keys pan the photo instead.
        onKeyDown={(e) => {
          const step = arrowStep(e.key, dir)
          if (step && !zoomed) go(index + step)
        }}
        className="start-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 content-center rounded-none bg-foreground p-0 text-background sm:max-w-none rtl:translate-x-0"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {item && (
          <div
            onClick={zoomable ? () => setZoomed(!zoomed) : undefined}
            tabIndex={zoomed ? 0 : undefined}
            aria-label={zoomed ? alt : undefined}
            role={zoomed ? "region" : undefined}
            className={cn(
              "h-[80dvh] w-full",
              zoomable &&
                (zoomed ? "cursor-zoom-out overflow-auto" : "cursor-zoom-in")
            )}
          >
            <GallerySlide
              key={item.id}
              media={item}
              alt={alt}
              sizes={zoomed ? "200vw" : "100vw"}
              fit="contain"
              className={cn(
                "aspect-auto bg-transparent",
                zoomed ? "h-[160dvh] w-[200%]" : "h-[80dvh] w-full"
              )}
            />
          </div>
        )}
        {zoomable && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.zoom")}
            aria-pressed={zoomed}
            onClick={() => setZoomed(!zoomed)}
            className="absolute end-12 top-2 text-background hover:bg-background/10 hover:text-background"
          >
            {zoomed ? <ZoomOutIcon /> : <ZoomInIcon />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.close")}
          onClick={onClose}
          className="absolute end-2 top-2 text-background hover:bg-background/10 hover:text-background"
        >
          <XIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.previous")}
          disabled={index === 0}
          onClick={() => go(index - 1)}
          className="absolute start-2 top-1/2 text-background hover:bg-background/10 hover:text-background"
        >
          <ChevronLeftIcon className="rtl:-scale-x-100" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.next")}
          disabled={index === last}
          onClick={() => go(index + 1)}
          className="absolute end-2 top-1/2 text-background hover:bg-background/10 hover:text-background"
        >
          <ChevronRightIcon className="rtl:-scale-x-100" />
        </Button>
        {item?.caption && (
          <p className="absolute inset-x-0 bottom-12 px-16 text-center text-body">
            {item.caption}
          </p>
        )}
        <p
          className="absolute inset-x-0 bottom-4 text-center text-ui"
          aria-live="polite"
        >
          {t("common.count_of", { current: index + 1, max: items.length })}
        </p>
      </DialogContent>
    </Dialog>
  )
}
