import { defaultStringifySearch, useNavigate } from "@tanstack/react-router"

import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import {
  dealershipProfileRouteSchema,
  dealershipProfileSearchSchema,
  type DealershipProfileSearch,
} from "./schemas"

// Tabs and inventory filters live in the URL. Replace, no scroll reset, no view transition; a page is a step in history.
export function useDealershipProfileNavigation(
  slug: string,
  search: DealershipProfileSearch
) {
  const navigate = useNavigate()
  const { locale } = useT()
  const go = (next: DealershipProfileSearch, replace: boolean) =>
    navigate({
      to: "/$locale/dealerships/$slug",
      params: { locale, slug },
      search: dealershipProfileRouteSchema.parse(next),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  return {
    // A tab starts with its own defaults: the inventory filters do not follow to the other tabs.
    onTab: (tab: DealershipProfileSearch["tab"]) =>
      go(dealershipProfileSearchSchema.parse({ tab }), true),
    // The inventory tab shows a full search; the profile keeps the part its URL can hold.
    onChange: (next: SearchParams) =>
      go(
        dealershipProfileSearchSchema.parse({ ...next, tab: "inventory" }),
        true
      ),
    onPageChange: (page: number) => go({ ...search, page }, false),
    hrefFor: (page: number) =>
      localeHref(
        `/dealerships/${slug}${defaultStringifySearch(dealershipProfileRouteSchema.parse({ ...search, page }))}`,
        locale
      ),
  }
}
