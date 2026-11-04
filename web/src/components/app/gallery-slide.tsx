import { useState } from "react"
import { PlayIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { mediaSrc } from "@/lib/media"
import type { Media } from "@sayaratak/shared/schemas/listing"
import { MediaImage } from "./media-image"

// An image, or a video that shows its poster until the person presses play.
export function GallerySlide({
  media,
  alt,
  sizes,
  priority,
  fit,
  className,
}: {
  media: Media
  alt: string
  sizes: string
  priority?: boolean
  fit?: "cover" | "contain"
  className?: string
}) {
  const { t } = useT()
  const [playing, setPlaying] = useState(false)
  if (media.type === "video" && playing)
    return (
      <video
        controls
        autoPlay
        preload="none"
        src={mediaSrc(media.url, 1280)}
        className={`bg-foreground object-contain ${className ?? ""}`}
      />
    )
  return (
    <div className="relative">
      <MediaImage
        src={media.type === "video" ? media.posterUrl : media.url}
        placeholderColor={media.placeholderColor}
        alt={alt}
        sizes={sizes}
        priority={priority}
        fit={fit}
        className={className}
      />
      {media.type === "video" && (
        <button
          type="button"
          aria-label={t("common.play_video")}
          onClick={() => setPlaying(true)}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-14 place-items-center rounded-full bg-foreground/70 text-background">
            <PlayIcon aria-hidden className="size-6" />
          </span>
        </button>
      )}
    </div>
  )
}
