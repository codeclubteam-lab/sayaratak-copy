import { useQuery } from "@tanstack/react-query"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { BannerSlot } from "@/components/app/banner-slot"
import { MechanicCard } from "@/components/app/mechanic-card"
import { PageHeader } from "@/components/app/page-header"
import { resultsHeadingId } from "@/components/app/results-header"
import { mechanicFilters } from "../mechanic-loader"
import { mechanicSearchSchema, type MechanicSearch } from "../mechanic-schemas"
import { directoryQueries } from "../queries"
import { DirectoryResults } from "./directory-results"
import { MechanicToolbar } from "./mechanic-toolbar"

export function MechanicsPage({
  search,
  onChange,
  onPageChange,
  hrefFor,
}: {
  search: MechanicSearch
  onChange: (next: MechanicSearch) => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
}) {
  const { t, locale } = useT()
  const list = useQuery(
    directoryQueries.mechanics.list(mechanicFilters(search))
  )
  return (
    <div className="flex flex-col gap-4 pt-4 pb-12 md:gap-6 md:pt-6">
      <BannerSlot placement="directory_top" ad="directory_mechanics" />
      <PageHeader
        title={t("nav.mechanics")}
        count={list.data && formatNumber(list.data.total, locale)}
        headingId={resultsHeadingId}
      />
      <MechanicToolbar
        search={search}
        onChange={onChange}
        resultCount={list.data?.total}
      />
      <DirectoryResults
        list={list}
        renderItem={(m) => <MechanicCard mechanic={m} headingAs="h2" />}
        errorMessage={t("directory.mechanics_load_error")}
        empty={{
          title: t("directory.mechanics_empty_title"),
          body: t("directory.mechanics_empty_body"),
        }}
        onClear={() => onChange(mechanicSearchSchema.parse({}))}
        onPageChange={onPageChange}
        hrefFor={hrefFor}
      />
    </div>
  )
}
