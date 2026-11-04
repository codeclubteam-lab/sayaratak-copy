import { lazy, Suspense, useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { MediaImage } from "./media-image"
import type { Captioned } from "./gallery-lightbox"

const Lightbox = lazy(() =>
  import("./gallery-lightbox").then((m) => ({ default: m.GalleryLightbox }))
)

// Thumbnails in a grid; a press opens the full-screen viewer (the listing gallery's lightbox) on that photo. A caption shows under its thumbnail and in the viewer.
export function PhotoGrid({
  items,
  alt,
  zoomable,
}: {
  items: Captioned[]
  alt: string
  zoomable?: boolean
}) {
  const { t } = useT()
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((m, i) => (
          <li key={m.id} className="flex flex-col gap-1">
            <button
              type="button"
              aria-label={t("directory.open_photo", {
                current: i + 1,
                max: items.length,
              })}
              onClick={() => setOpen(i)}
              className="block w-full press rounded-lg"
            >
              <MediaImage
                src={m.url}
                alt=""
                placeholderColor={m.placeholderColor}
                sizes="(min-width: 640px) 33vw, 50vw"
              />
            </button>
            {m.caption && (
              <p className="text-caption text-muted-foreground">{m.caption}</p>
            )}
          </li>
        ))}
      </ul>
      {open !== null && (
        <Suspense fallback={null}>
          <Lightbox
            items={items}
            alt={alt}
            index={open}
            onIndex={setOpen}
            onClose={() => setOpen(null)}
            zoomable={zoomable}
          />
        </Suspense>
      )}
    </>
  )
}
