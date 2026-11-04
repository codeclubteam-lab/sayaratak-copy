import { defaultStringifySearch, useNavigate } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { mechanicRouteSchema, type MechanicSearch } from "./mechanic-schemas"

// Filters write to the URL (A13). The page stays: replace, no scroll reset, no view transition. A page is a step in history, so the back button returns to the one before.
export function useMechanicNavigation(search: MechanicSearch) {
  const navigate = useNavigate()
  const { locale } = useT()
  const go = (next: MechanicSearch, replace: boolean) =>
    navigate({
      to: "/$locale/mechanics",
      params: { locale },
      search: mechanicRouteSchema.parse(next),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  return {
    onChange: (next: MechanicSearch) => go(next, true),
    onPageChange: (page: number) => go({ ...search, page }, false),
    hrefFor: (page: number) =>
      localeHref(
        `/mechanics${defaultStringifySearch(mechanicRouteSchema.parse({ ...search, page }))}`,
        locale
      ),
  }
}
