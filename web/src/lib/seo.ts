import { defaultLocale } from "@/lib/i18n/server"
import type { Locale } from "@sayaratak/shared/schemas/locale"

const locales: Locale[] = ["ar", "en"]
const ogLocale = { ar: "ar_AR", en: "en_US" } as const

// Canonical and hreflang URLs must be absolute: APP_ORIGIN on the server, the page origin in the browser.
export const origin = () =>
  typeof window === "undefined"
    ? (process.env.APP_ORIGIN ?? "")
    : window.location.origin

type HeadInput = {
  title: string
  description?: string
  path: string
  locale: Locale
  image?: string
  noindex?: boolean
}

// Title, description, canonical, hreflang (ar, en, x-default), Open Graph, Twitter and robots for a route's head().
export function buildHead({
  title,
  description,
  path,
  locale,
  image,
  noindex,
}: HeadInput) {
  const base = origin()
  const rest = path.replace(/^\/(?:ar|en)(?=\/|$)/, "").replace(/^\/$/, "")
  const url = (l: Locale) => `${base}/${l}${rest}`
  const full = `${title} | Sayaratak`
  const img = image?.startsWith("/") ? base + image : image
  const meta = [
    { title: full },
    description && { name: "description", content: description },
    noindex && { name: "robots", content: "noindex, follow" },
    { property: "og:site_name", content: "Sayaratak" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: full },
    description && { property: "og:description", content: description },
    { property: "og:url", content: url(locale) },
    { property: "og:locale", content: ogLocale[locale] },
    img && { property: "og:image", content: img },
    { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: full },
    description && { name: "twitter:description", content: description },
    img && { name: "twitter:image", content: img },
  ].filter((m) => !!m)
  const links = [
    { rel: "canonical", href: url(locale) },
    ...locales.map((l) => ({ rel: "alternate", hrefLang: l, href: url(l) })),
    { rel: "alternate", hrefLang: "x-default", href: url(defaultLocale) },
  ]
  return { meta, links }
}
