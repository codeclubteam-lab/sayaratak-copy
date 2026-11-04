import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { AreaChartCard } from "@/components/app/area-chart-card"
import { BarChartCard } from "@/components/app/bar-chart-card"
import { DateRangeSelect } from "@/components/app/date-range-select"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import { analyticsQuery } from "../queries"
import { analyticsSearchSchema } from "../schemas"
import { StatRow } from "./stat-row"
import { TopListingsTable } from "./top-listings-table"

// Counts from the public pages for a period: five cards with the change against the period before, views over time, contacts per day, and (dealerships) the ten listings with the most views. The period lives in the URL.
export function AnalyticsPage({
  role,
}: {
  role: "dealership" | "workshop" | "mechanic"
}) {
  const { t } = useT()
  const title = t("dashboard.nav_analytics")
  usePageTitle(title)
  const { range } = analyticsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { data, isPending, isError, refetch } = useQuery(analyticsQuery(range))
  const days = data?.daily.map(({ date, ...counts }) => ({
    day: date,
    ...counts,
  }))
  const chart = { data: days, loading: isPending }
  const setRange = (next: Range) =>
    void navigate({
      to: ".",
      search: next === "30d" ? {} : { range: next },
      replace: true,
      resetScroll: false,
      viewTransition: false,
    })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <DateRangeSelect value={range} onChange={setRange} />
      </PageHeader>
      {isError ? (
        <SectionError
          message={t("analytics.load_error")}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <StatRow role={role} data={data} loading={isPending} />
          <AreaChartCard
            title={t(
              role === "dealership"
                ? "analytics.chart_views"
                : "analytics.chart_profile_views"
            )}
            series={[{ key: "views", label: t("analytics.series_views") }]}
            {...chart}
          />
          <BarChartCard
            title={t("analytics.chart_contacts")}
            series={[
              { key: "calls", label: t("analytics.series_calls") },
              { key: "whatsapp", label: t("analytics.series_whatsapp") },
              { key: "messages", label: t("analytics.series_messages") },
            ]}
            stacked
            {...chart}
          />
          {role === "dealership" && (
            <TopListingsTable rows={data?.topListings} loading={isPending} />
          )}
        </>
      )}
    </div>
  )
}
