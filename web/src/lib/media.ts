export const mediaWidths = [320, 640, 960, 1280] as const
export const cardSizes =
  "(min-width: 1280px) 280px, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
export const detailSizes = "(min-width: 1024px) 720px, 100vw"

// Image urls are templates with `{w}`; a plain url has one size only.
export const mediaSrc = (url: string, width: number) =>
  url.replace("{w}", String(width))

export function mediaSrcSet(url: string, maxWidth: number) {
  if (!url.includes("{w}")) return undefined
  return mediaWidths
    .filter((w) => w <= maxWidth)
    .map((w) => `${mediaSrc(url, w)} ${w}w`)
    .join(", ")
}

// Arrow keys follow the visual direction: in RTL the left arrow goes to the next item.
export function arrowStep(key: string, dir: "ltr" | "rtl") {
  if (key !== "ArrowLeft" && key !== "ArrowRight") return 0
  return (key === "ArrowRight") === (dir === "ltr") ? 1 : -1
}
