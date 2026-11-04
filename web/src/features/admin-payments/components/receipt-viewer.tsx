import { lazy, Suspense, useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { MediaImage } from "@/components/app/media-image"

const Lightbox = lazy(() =>
  import("@/components/app/gallery-lightbox").then((m) => ({
    default: m.GalleryLightbox,
  }))
)

// The receipt large in the sheet; a press opens the full-screen viewer with zoom.
export function ReceiptViewer({ url }: { url: string }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const alt = t("admin.payment_receipt")
  return (
    <>
      <button
        type="button"
        aria-label={t("admin.payment_receipt_open")}
        onClick={() => setOpen(true)}
        className="block w-full press rounded-lg"
      >
        <MediaImage
          src={url}
          alt=""
          fit="contain"
          sizes="470px"
          className="aspect-[3/4] w-full rounded-lg bg-muted"
        />
      </button>
      {open && (
        <Suspense fallback={null}>
          <Lightbox
            items={[
              {
                id: "receipt",
                type: "image",
                url,
                width: 0,
                height: 0,
                placeholderColor: "",
                posterUrl: null,
              },
            ]}
            alt={alt}
            index={0}
            onIndex={() => undefined}
            onClose={() => setOpen(false)}
            zoomable
          />
        </Suspense>
      )}
    </>
  )
}
