import { useQuery } from "@tanstack/react-query"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { BannerSlot } from "@/components/app/banner-slot"
import { DealershipCard } from "@/components/app/dealership-card"
import { PageHeader } from "@/components/app/page-header"
import { resultsHeadingId } from "@/components/app/results-header"
import { dealershipFilters } from "../loader"
import { directoryQueries } from "../queries"
import { dealershipSearchSchema, type DealershipSearch } from "../schemas"
import { DealershipToolbar } from "./dealership-toolbar"
import { DirectoryResults } from "./directory-results"

export function DealershipsPage({
  search,
  onChange,
  onPageChange,
  hrefFor,
}: {
  search: DealershipSearch
  onChange: (next: DealershipSearch) => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
}) {
  const { t, locale } = useT()
  const list = useQuery(
    directoryQueries.dealerships.list(dealershipFilters(search))
  )
  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:gap-6 md:pt-6">
      <BannerSlot placement="directory_top" ad="directory_dealerships" />
      <PageHeader
        title={t("nav.dealerships")}
        count={list.data && formatNumber(list.data.total, locale)}
        headingId={resultsHeadingId}
      />
      <DealershipToolbar
        search={search}
        onChange={onChange}
        resultCount={list.data?.total}
      />
      <DirectoryResults
        list={list}
        renderItem={(d) => <DealershipCard dealership={d} headingAs="h2" />}
        errorMessage={t("directory.load_error")}
        empty={{
          title: t("directory.dealerships_empty_title"),
          body: t("directory.dealerships_empty_body"),
        }}
        onClear={() => onChange(dealershipSearchSchema.parse({}))}
        onPageChange={onPageChange}
        hrefFor={hrefFor}
      />
    </div>
  )
}
