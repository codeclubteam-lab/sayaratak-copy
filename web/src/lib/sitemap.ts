import { localeSchema } from "@sayaratak/shared/schemas/locale"
import type { SitemapEntry } from "@sayaratak/shared/schemas/responses"

const locales = localeSchema.options
const defaultLocale = "ar"

// Dashboards and flows that never belong in a search index (A6).
const closed = [
  "account",
  "dealer",
  "workshop",
  "mechanic",
  "admin",
  "auth",
  "onboarding",
  "post",
]

export type { SitemapEntry }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

// One <url> per locale, each listing every language of the page (and x-default) as xhtml:link alternates. `path` has no locale prefix: "" is the home page.
export function sitemapXml(origin: string, entries: SitemapEntry[]) {
  const loc = (l: string, path: string) =>
    esc(`${origin}/${l}${encodeURI(path)}`)
  const url = ({ path, lastmod }: SitemapEntry) =>
    locales
      .map(
        (l) =>
          `<url><loc>${loc(l, path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}` +
          [...locales, "x-default"]
            .map(
              (a) =>
                `<xhtml:link rel="alternate" hreflang="${a}" href="${loc(a === "x-default" ? defaultLocale : a, path)}"/>`
            )
            .join("") +
          "</url>"
      )
      .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(url).join("\n")}
</urlset>
`
}

export const robotsTxt = (origin: string) =>
  [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    // `/ar/dealer` alone would also block the public `/ar/dealerships`, so a section is closed as the exact path and as the folder.
    ...locales.flatMap((l) =>
      closed.flatMap((s) => [`Disallow: /${l}/${s}$`, `Disallow: /${l}/${s}/`])
    ),
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n")
