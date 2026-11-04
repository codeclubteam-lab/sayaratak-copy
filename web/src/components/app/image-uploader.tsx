import { lazy, Suspense } from "react"

import type { Media } from "@sayaratak/shared/schemas/listing"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export type ImageUploaderProps = {
  mode: "multi" | "single"
  value: Media[]
  onChange: (value: Media[]) => void
  min?: number
  max?: number
  shape?: "wide" | "square" | "round"
  label?: string
  // Multi mode: photo 1 is badged "Cover". False says "First" where the page has a separate cover image.
  cover?: boolean
}

// `shape` only crops the single-mode preview; multi mode always shows 4:3 photos.
export const uploadBoxes = {
  wide: "aspect-[2/1] w-full rounded-lg md:aspect-[3/1]",
  square: "size-32 rounded-lg",
  round: "size-32 rounded-full",
}

// The implementation (resizing, upload state, reordering) stays out of the first load.
const Impl = lazy(() =>
  import("./image-uploader-impl").then((m) => ({
    default: m.ImageUploaderImpl,
  }))
)

// Single mode holds the loaded layout's size (label and box), so nothing below it moves when the implementation arrives.
function Fallback({ mode, shape = "wide", label }: ImageUploaderProps) {
  if (mode === "multi")
    return <Skeleton className="aspect-[4/3] w-full max-w-lg rounded-lg" />
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2",
        shape === "wide" && "w-full max-w-lg"
      )}
    >
      {label && <span className="text-ui font-medium">{label}</span>}
      <Skeleton className={uploadBoxes[shape]} />
    </div>
  )
}

export function ImageUploader(props: ImageUploaderProps) {
  return (
    <Suspense fallback={<Fallback {...props} />}>
      <Impl {...props} />
    </Suspense>
  )
}
