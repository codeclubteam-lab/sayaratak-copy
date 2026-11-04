import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import { MediaImage } from "./media-image"
import { RemoveButton } from "./remove-button"

// A finished photo with its order controls. The whole tile can also be dragged.
export function MediaTile({
  media,
  index,
  count,
  cover,
  onMove,
  onRemove,
  onDragStart,
  onDropHere,
}: {
  media: Media
  index: number
  count: number
  cover: boolean
  onMove: (to: number) => void
  onRemove: () => void
  onDragStart: () => void
  onDropHere: () => void
}) {
  const { t } = useT()
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHere}
      className="flex flex-col gap-1"
    >
      <div className="relative">
        <MediaImage
          src={media.url}
          placeholderColor={media.placeholderColor}
          alt={t("common.photo_number", { number: index + 1 })}
          sizes="(min-width: 768px) 25vw, 50vw"
        />
        {index === 0 && (
          <span className="absolute start-2 top-2 rounded-full bg-card px-2 text-caption font-medium">
            {t(cover ? "common.cover" : "common.first")}
          </span>
        )}
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.move_earlier")}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ChevronLeftIcon className="rtl:-scale-x-100" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.move_later")}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ChevronRightIcon className="rtl:-scale-x-100" />
        </Button>
        <RemoveButton
          variant="ghost"
          size="icon"
          aria-label={t("common.remove")}
          title={t("common.remove_photo_title")}
          onConfirm={onRemove}
        >
          <XIcon />
        </RemoveButton>
      </div>
      {index > 0 && (
        <Button variant="secondary" onClick={() => onMove(0)}>
          {t(cover ? "common.set_cover" : "common.move_first")}
        </Button>
      )}
    </div>
  )
}
