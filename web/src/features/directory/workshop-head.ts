import { buildHead } from "@/lib/seo"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { WorkshopProfileSearch, WorkshopSearch } from "./workshop-schemas"

// A6: a directory with any query value other than `page` is noindex with the canonical on the plain directory.
export function workshopsHead(
  data: { title: string; description: string; locale: Locale } | undefined,
  s: WorkshopSearch
) {
  if (!data) return { meta: [], links: [] }
  const filtered = Boolean(
    s.q ||
    s.city ||
    s.service ||
    s.verified ||
    s.openNow ||
    s.lat !== undefined ||
    s.sort !== "rating"
  )
  return buildHead({
    ...data,
    noindex: filtered,
    path: filtered || s.page === 1 ? "/workshops" : `/workshops?page=${s.page}`,
  })
}

// The services tab is the profile itself; the other tabs have their own canonical.
export function workshopHead(
  data:
    | {
        title: string
        description: string
        locale: Locale
        slug: string
        image?: string
        // The owner is banned: the page stays up with a notice, out of search engines.
        unavailable?: true
      }
    | undefined,
  s: WorkshopProfileSearch
) {
  if (!data) return { meta: [], links: [] }
  const base = `/workshops/${data.slug}`
  return buildHead({
    ...data,
    path: s.tab === "services" ? base : `${base}?tab=${s.tab}`,
    noindex: !!data.unavailable,
  })
}
