import { defaultStringifySearch, useNavigate } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { dealershipRouteSchema, type DealershipSearch } from "./schemas"

// Filters write to the URL (A13). The page stays: replace, no scroll reset, no view transition. A page is a step in history, so the back button returns to the one before.
export function useDealershipNavigation(search: DealershipSearch) {
  const navigate = useNavigate()
  const { locale } = useT()
  const go = (next: DealershipSearch, replace: boolean) =>
    navigate({
      to: "/$locale/dealerships",
      params: { locale },
      search: dealershipRouteSchema.parse(next),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  return {
    onChange: (next: DealershipSearch) => go(next, true),
    onPageChange: (page: number) => go({ ...search, page }, false),
    hrefFor: (page: number) =>
      localeHref(
        `/dealerships${defaultStringifySearch(dealershipRouteSchema.parse({ ...search, page }))}`,
        locale
      ),
  }
}
