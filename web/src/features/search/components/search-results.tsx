import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"

import { listingQueries } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { ActiveFilterChips } from "@/components/app/active-filter-chips"
import { EmptyResults } from "@/components/app/empty-results"
import { FilterPanel } from "@/components/app/filter-panel"
import { FilterSheet } from "@/components/app/filter-sheet"
import { ListingGrid } from "@/components/app/listing-grid"
import { MakeLogo } from "@/components/app/make-logo"
import { GridCard } from "@/components/app/page-skeleton"
import { ResultsHeader } from "@/components/app/results-header"
import { ResultsPagination } from "@/components/app/results-pagination"
import { ResultsRegion } from "@/components/app/results-region"
import { SectionError } from "@/components/app/section-error"
import { SortSelect } from "@/components/app/sort-select"
import type { FilterGroup } from "../filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { ViewToggle } from "./view-toggle"

const vehicleSorts = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "year_desc",
  "mileage_asc",
] as const
const partSorts = ["relevance", "newest", "price_asc", "price_desc"] as const

// Everything under the page's own heading: controls, chips, filter panel, grid, pagination. The search pages and a profile's inventory tab share it. The route owns the URL: `search` is what it parsed, `onChange` writes a whole new set of filters back, and the page changes come as links. `groups` limits the filter blocks to the ones the route can keep in its URL.
export function SearchResults({
  search,
  onChange,
  onPageChange,
  hrefFor,
  title,
  headingAs,
  groups,
  actions,
}: {
  search: SearchParams
  onChange: (next: SearchParams) => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
  title: string
  headingAs?: "h1" | "h2"
  groups?: readonly FilterGroup[]
  actions?: ReactNode
}) {
  const { t } = useT()
  const list = useQuery(listingQueries.list(search))
  const { data } = list

  const sorts: SearchParams["sort"][] = [
    ...(search.kind === "part" ? partSorts : vehicleSorts),
    ...(search.lat !== undefined && search.lng !== undefined
      ? (["nearest"] as const)
      : []),
  ]

  const pageCount = data ? Math.ceil(data.total / data.pageSize) : 0
  let results
  if (!data)
    results = list.isError ? (
      <SectionError
        message={t("search.load_error")}
        onRetry={() => {
          void list.refetch()
        }}
      />
    ) : (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <GridCard key={i} />
        ))}
      </div>
    )
  else if (data.total === 0)
    results = (
      <EmptyResults params={search} facets={data.facets} onChange={onChange} />
    )
  else
    results = (
      <>
        <ResultsRegion stale={list.isPlaceholderData}>
          <ListingGrid listings={data.items} eager={4} sidebar />
        </ResultsRegion>
        <ResultsPagination
          page={data.page}
          pageCount={pageCount}
          hrefFor={hrefFor}
          onPageChange={onPageChange}
        />
      </>
    )

  return (
    <>
      <ResultsHeader
        title={title}
        total={data?.total}
        as={headingAs}
        icon={<MakeLogo id={search.make} size="md" />}
      >
        <FilterSheet
          params={search}
          facets={data?.facets}
          groups={groups}
          onApply={onChange}
        />
        <SortSelect
          value={search.sort}
          options={sorts}
          onChange={(sort) => onChange({ ...search, sort, page: 1 })}
        />
        <ViewToggle />
        {actions}
      </ResultsHeader>
      <ActiveFilterChips params={search} onChange={onChange} />
      <div className="grid gap-6 lg:grid-cols-[296px_minmax(0,1fr)]">
        <FilterPanel
          params={search}
          facets={data?.facets}
          groups={groups}
          onApply={onChange}
          className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto lg:block"
        />
        <div className="flex min-w-0 flex-col gap-6">{results}</div>
      </div>
    </>
  )
}
