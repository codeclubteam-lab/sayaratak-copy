import { useNavigate } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { routeHref, searchRoute } from "./landing"
import type { SearchParams } from "@sayaratak/shared/search/schemas"

// Filters write to the URL (A13). The page stays: replace, no scroll reset, no view transition. A filter the path holds (type, intent, city) moves to the matching landing, and a search that fits none goes to /search.
export function useSearchNavigation(search: SearchParams) {
  const navigate = useNavigate()
  const { locale } = useT()
  const go = (next: SearchParams, replace: boolean) => {
    const r = searchRoute(next)
    const options = { replace, resetScroll: false, viewTransition: false }
    if (r.to === "landing")
      return navigate({
        to: "/$locale/vehicles/$type/$intent/{-$city}",
        params: { locale, type: r.type, intent: r.intent, city: r.city },
        search: r.search,
        ...options,
      })
    return navigate({
      to: r.to === "parts" ? "/$locale/parts" : "/$locale/search",
      params: { locale },
      search: r.search,
      ...options,
    })
  }
  return {
    onChange: (next: SearchParams) => go(next, true),
    // A page is a step in history, so the back button returns to the one before.
    onPageChange: (page: number) => go({ ...search, page }, false),
    // Real addresses for the pagination links.
    hrefFor: (page: number) =>
      localeHref(routeHref(searchRoute({ ...search, page })), locale),
  }
}
