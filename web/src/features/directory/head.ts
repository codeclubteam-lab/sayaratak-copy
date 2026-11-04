import { buildHead } from "@/lib/seo"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { DealershipProfileSearch, DealershipSearch } from "./schemas"

// A6: a directory with any query value other than `page` is noindex with the canonical on the plain directory.
export function dealershipsHead(
  data: { title: string; description: string; locale: Locale } | undefined,
  s: DealershipSearch
) {
  if (!data) return { meta: [], links: [] }
  const filtered = Boolean(s.q || s.city || s.verified || s.sort !== "rating")
  return buildHead({
    ...data,
    noindex: filtered,
    path:
      filtered || s.page === 1 ? "/dealerships" : `/dealerships?page=${s.page}`,
  })
}

// The inventory tab is the profile itself; the other tabs have their own canonical. Inventory filters make the page noindex with the canonical on the plain profile.
export function dealershipHead(
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
  s: DealershipProfileSearch
) {
  if (!data) return { meta: [], links: [] }
  const base = `/dealerships/${data.slug}`
  const filtered =
    [
      s.type,
      s.intent,
      s.make,
      s.minPrice,
      s.maxPrice,
      s.minYear,
      s.maxYear,
    ].some((v) => v !== undefined) || s.sort !== "relevance"
  const path = filtered
    ? base
    : s.tab !== "inventory"
      ? `${base}?tab=${s.tab}`
      : s.page > 1
        ? `${base}?page=${s.page}`
        : base
  return buildHead({
    ...data,
    path,
    noindex: filtered || !!data.unavailable,
  })
}
