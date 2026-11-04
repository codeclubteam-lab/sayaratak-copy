import { useQuery } from "@tanstack/react-query"
import { defaultStringifySearch } from "@tanstack/react-router"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { adPageOf } from "@/features/ads/ad-page-of"
import { BannerSlot } from "@/components/app/banner-slot"
import { Breadcrumbs } from "@/components/app/breadcrumbs"
import { SaveSearchButton } from "@/components/app/save-search-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { routeHref, searchRoute } from "../landing"
import {
  compact,
  searchParamsSchema,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"
import { searchTitle } from "../title"
import { SearchBar } from "./search-bar"
import { SearchResults } from "./search-results"

// One results page for /search, /parts and the landing presets: banner, breadcrumbs and the search bar around `SearchResults`.
export function SearchPage({
  search,
  onChange,
  onPageChange,
  hrefFor,
}: {
  search: SearchParams
  onChange: (next: SearchParams) => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const title = searchTitle(search, tax, locale, t)

  const category =
    search.kind === "part"
      ? t("search.all_parts")
      : (tax?.vehicleTypes.find((v) => v.id === search.type)?.name[locale] ??
        t("search.all_vehicles"))
  const city = tax?.cities.find((c) => c.id === search.city)?.name[locale]
  const crumbs = [
    { label: t("nav.home"), href: "/" },
    city
      ? {
          label: category,
          href: routeHref(
            searchRoute({
              ...searchParamsSchema.parse({}),
              kind: search.kind,
              type: search.type,
              intent: search.intent,
            })
          ),
        }
      : { label: category },
    ...(city ? [{ label: city }] : []),
  ]

  // The map takes the same filters; paging has no meaning there.
  const map = `/map${defaultStringifySearch(compact({ ...search, page: 1 }))}`

  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:pt-6">
      <BannerSlot placement="search_top" ad={adPageOf(search)} />
      <Breadcrumbs items={crumbs} />
      <SearchBar search={search} onChange={onChange} />
      <SearchResults
        search={search}
        onChange={onChange}
        onPageChange={onPageChange}
        hrefFor={hrefFor}
        title={title}
        actions={
          <>
            <SaveSearchButton params={search} />
            <a
              href={localeHref(map, locale)}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t("search.show_on_map")}
            </a>
          </>
        }
      />
    </div>
  )
}
