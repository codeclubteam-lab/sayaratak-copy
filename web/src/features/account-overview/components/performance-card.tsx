import { useQuery } from "@tanstack/react-query"

import { AreaChartCard } from "@/components/app/area-chart-card"
import { analyticsQuery } from "@/features/analytics/queries"
import { useT } from "@/lib/i18n/use-t"

// Daily views of all the user's listings, last 30 days.
export function PerformanceCard() {
  const { t } = useT()
  const { data, isPending, isError, refetch } = useQuery(analyticsQuery("30d"))
  return (
    <AreaChartCard
      title={t("dashboard.overview_performance_title")}
      series={[{ key: "views", label: t("analytics.series_views") }]}
      data={data?.daily.map(({ date, views }) => ({ day: date, views }))}
      loading={isPending}
      error={isError}
      onRetry={() => void refetch()}
    />
  )
}
