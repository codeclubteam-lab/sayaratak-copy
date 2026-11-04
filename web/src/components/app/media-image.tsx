import { useState } from "react"
import { ImageOffIcon } from "lucide-react"

import { mediaSrc, mediaSrcSet } from "@/lib/media"
import { usePrefs } from "@/lib/prefs"
import { cn } from "@/lib/utils"

const DATA_SAVER_WIDTH = 640

// `alt` is required: pass "" on purpose for a decorative image.
// `src` is a url template with `{w}`; the box has a fixed ratio, so nothing jumps while the file loads.
export function MediaImage({
  src,
  alt,
  placeholderColor,
  sizes,
  priority = false,
  fit = "cover",
  className,
}: {
  src: string | null
  alt: string
  placeholderColor?: string
  sizes?: string
  priority?: boolean
  fit?: "cover" | "contain"
  className?: string
}) {
  const { dataSaver } = usePrefs()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // A file that finished (or failed) before hydration never fires `onLoad` or `onError` again, so the ref callback checks it.
  const check = (img: HTMLImageElement | null) => {
    if (!img?.complete) return
    if (img.naturalWidth === 0) setFailed(true)
    else setLoaded(true)
  }
  const maxWidth = dataSaver ? DATA_SAVER_WIDTH : 1280
  return (
    <div
      data-media=""
      role={alt && (failed || !src) ? "img" : undefined}
      aria-label={alt && (failed || !src) ? alt : undefined}
      className={cn(
        "relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-muted",
        className
      )}
      style={
        placeholderColor && !failed
          ? { backgroundColor: placeholderColor }
          : undefined
      }
    >
      {src && !failed ? (
        <img
          ref={check}
          data-fade={priority ? undefined : ""}
          data-loaded={loaded ? "" : undefined}
          src={mediaSrc(src, Math.min(960, maxWidth))}
          srcSet={mediaSrcSet(src, maxWidth)}
          sizes={sizes}
          width={1280}
          height={960}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 size-full",
            fit === "cover" ? "object-cover" : "object-contain"
          )}
        />
      ) : (
        <ImageOffIcon aria-hidden className="size-5 text-muted-foreground" />
      )}
    </div>
  )
}
