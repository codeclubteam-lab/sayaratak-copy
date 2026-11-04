import { buildHead } from "@/lib/seo"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { MechanicProfileSearch, MechanicSearch } from "./mechanic-schemas"

// A6: a directory with any query value other than `page` is noindex with the canonical on the plain directory.
export function mechanicsHead(
  data: { title: string; description: string; locale: Locale } | undefined,
  s: MechanicSearch
) {
  if (!data) return { meta: [], links: [] }
  const filtered = Boolean(
    s.q ||
    s.city ||
    s.specialization ||
    s.minYears ||
    s.verified ||
    s.available ||
    s.sort !== "rating"
  )
  return buildHead({
    ...data,
    noindex: filtered,
    path: filtered || s.page === 1 ? "/mechanics" : `/mechanics?page=${s.page}`,
  })
}

// The work tab is the profile itself; the other tabs have their own canonical.
export function mechanicHead(
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
  s: MechanicProfileSearch
) {
  if (!data) return { meta: [], links: [] }
  const base = `/mechanics/${data.slug}`
  return buildHead({
    ...data,
    path: s.tab === "work" ? base : `${base}?tab=${s.tab}`,
    noindex: !!data.unavailable,
  })
}
