// The four widths the web asks for. Each is an eager derivative made at upload;
// with strict transformations on, any other width answers 404 (A8).
export const IMAGE_WIDTHS = [320, 640, 960, 1280] as const
export const DEFAULT_WIDTH = 1280
export const WIDTH_SLOT = "{w}"

/**
 * The eager transformation for one width. The delivery URL must use the exact
 * same string, or Cloudinary treats it as a new (and, under strict
 * transformations, refused) derivative.
 */
export function widthTransformation(width: number | typeof WIDTH_SLOT) {
  return `c_limit,f_webp,q_auto,w_${width}`
}

/** A public image's address with `{w}` for the web to fill. */
export function imageTemplate(cloudName: string, publicId: string) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${widthTransformation(WIDTH_SLOT)}/${publicId}`
}

/** A public video's address: the stored original, already capped on upload. */
export function videoUrl(cloudName: string, publicId: string, mime: string) {
  const extension = mime === "video/webm" ? "webm" : "mp4"
  return `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}.${extension}`
}

/** One of the four widths; anything else falls back to the largest. */
export function pickWidth(asked: number) {
  return IMAGE_WIDTHS.find((width) => width === asked) ?? DEFAULT_WIDTH
}
