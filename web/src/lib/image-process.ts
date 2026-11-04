export const MAX_INPUT_BYTES = 25 * 1024 * 1024
export const MAX_OUTPUT_BYTES = 5 * 1024 * 1024
const LONG_SIDE = 1600

export type ProcessedImage = {
  blob: Blob
  width: number
  height: number
  placeholderColor: string
}

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  return canvas
}
const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82)
  )

// Decodes with EXIF rotation applied, resizes to 1600 px on the long side, encodes WebP.
// Errors carry a `validation.*` key as their message, so the uploader can show them as they are.
export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) throw new Error("validation.image_type")
  if (file.size > MAX_INPUT_BYTES) throw new Error("validation.file_size_25mb")
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error("validation.image_type")
  })
  try {
    const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = canvasOf(width, height)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height)
    const blob = await toBlob(canvas)
    if (!blob) throw new Error("validation.image_type")
    if (blob.size > MAX_OUTPUT_BYTES)
      throw new Error("validation.file_size_5mb")
    return { blob, width, height, placeholderColor: averageColor(canvas) }
  } finally {
    bitmap.close()
  }
}

// One pixel is the average of the whole image once the browser scales it down.
export function averageColor(source: CanvasImageSource) {
  const pixel = canvasOf(1, 1).getContext("2d", { willReadFrequently: true })
  if (!pixel) return "#c9d3cf"
  pixel.drawImage(source, 0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = pixel.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}
