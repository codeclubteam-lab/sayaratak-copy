import { defaultStringifySearch, useNavigate } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { workshopRouteSchema, type WorkshopSearch } from "./workshop-schemas"

// Filters write to the URL (A13). The page stays: replace, no scroll reset, no view transition. A page is a step in history, so the back button returns to the one before.
export function useWorkshopNavigation(search: WorkshopSearch) {
  const navigate = useNavigate()
  const { locale } = useT()
  const go = (next: WorkshopSearch, replace: boolean) =>
    navigate({
      to: "/$locale/workshops",
      params: { locale },
      search: workshopRouteSchema.parse(next),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  return {
    onChange: (next: WorkshopSearch) => go(next, true),
    onPageChange: (page: number) => go({ ...search, page }, false),
    hrefFor: (page: number) =>
      localeHref(
        `/workshops${defaultStringifySearch(workshopRouteSchema.parse({ ...search, page }))}`,
        locale
      ),
  }
}
