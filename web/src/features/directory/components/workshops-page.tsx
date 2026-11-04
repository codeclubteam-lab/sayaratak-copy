import { useQuery } from "@tanstack/react-query"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { BannerSlot } from "@/components/app/banner-slot"
import { PageHeader } from "@/components/app/page-header"
import { resultsHeadingId } from "@/components/app/results-header"
import { WorkshopCard } from "@/components/app/workshop-card"
import { directoryQueries } from "../queries"
import { workshopSearchSchema, type WorkshopSearch } from "../workshop-schemas"
import { workshopFilters } from "../workshop-loader"
import { DirectoryResults } from "./directory-results"
import { WorkshopToolbar } from "./workshop-toolbar"

export function WorkshopsPage({
  search,
  onChange,
  onPageChange,
  hrefFor,
}: {
  search: WorkshopSearch
  onChange: (next: WorkshopSearch) => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
}) {
  const { t, locale } = useT()
  const list = useQuery(
    directoryQueries.workshops.list(workshopFilters(search))
  )
  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:gap-6 md:pt-6">
      <BannerSlot placement="directory_top" ad="directory_workshops" />
      <PageHeader
        title={t("nav.workshops")}
        count={list.data && formatNumber(list.data.total, locale)}
        headingId={resultsHeadingId}
      />
      <WorkshopToolbar
        search={search}
        onChange={onChange}
        resultCount={list.data?.total}
      />
      <DirectoryResults
        list={list}
        renderItem={(w) => <WorkshopCard workshop={w} headingAs="h2" />}
        errorMessage={t("directory.workshops_load_error")}
        empty={{
          title: t("directory.workshops_empty_title"),
          body: t("directory.workshops_empty_body"),
        }}
        onClear={() => onChange(workshopSearchSchema.parse({}))}
        onPageChange={onPageChange}
        hrefFor={hrefFor}
      />
    </div>
  )
}
