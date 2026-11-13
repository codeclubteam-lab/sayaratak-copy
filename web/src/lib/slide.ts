export type SlideIcon = "car" | "truck" | "wrench" | "bike" | "tuk"

// One hero carousel slide. `eyebrow` is the small line above the title (an ad shows `advertiser` there when it has one). `trackingUrl` only travels to the carousel callbacks; the carousel never calls it.
export type Slide = {
  id: string
  kind: "house" | "ad"
  eyebrow?: string
  title: string
  body?: string
  cta: { label: string; href: string }
  image?: { src: string; alt: string; objectPosition?: string; flip?: boolean }
  background?: string
  icon?: SlideIcon
  advertiser?: string
  trackingUrl?: string
}

export const MIN_CONTRAST = 4.5

const channel = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

// WCAG contrast of white text on `color`. Reads #rgb, #rrggbb and rgb(r g b); any other CSS color (var(), oklch) cannot be read here and gives null.
export function contrastWithWhite(color: string): number | null {
  const value = color.trim()
  let rgb: number[] | null = null
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex
    rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
  } else {
    const m = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/i.exec(value)
    if (m) rgb = [Number(m[1]), Number(m[2]), Number(m[3])]
  }
  const [r = 0, g = 0, b = 0] = (rgb ?? []).map(channel)
  return rgb ? 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05) : null
}

// A background too light for white text is rejected: the slide keeps the default deep blue, and development warns. Colors that cannot be measured pass.
export function safeBackground(slide: Slide) {
  const ratio = slide.background ? contrastWithWhite(slide.background) : null
  if (!slide.background || ratio === null || ratio >= MIN_CONTRAST)
    return slide.background
  if (import.meta.env.DEV)
    console.warn(
      `Slide ${slide.id}: background ${slide.background} has ${ratio.toFixed(2)}:1 contrast with white text (needs ${MIN_CONTRAST}:1). Ignored.`
    )
  return undefined
}
