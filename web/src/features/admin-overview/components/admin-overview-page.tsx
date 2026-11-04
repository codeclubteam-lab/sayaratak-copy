import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { AreaChartCard } from "@/components/app/area-chart-card"
import { BarChartCard } from "@/components/app/bar-chart-card"
import { DateRangeSelect } from "@/components/app/date-range-select"
import { PageHeader } from "@/components/app/page-header"
import { adminQueries } from "@/features/admin/queries"
import { analyticsSearchSchema } from "@/features/analytics/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import type { AdminStats } from "@sayaratak/shared/schemas/responses"
import { ActivityFeed } from "./activity-feed"
import { AdminStatGrid } from "./admin-stat-grid"
import { QueuesCard } from "./queues-card"

const rows = (points?: AdminStats["series"]["newUsers"]) =>
  points?.map(({ date, value }) => ({ day: date, value }))

// The admin's first screen: site totals, three daily series for the period, the four queues and the latest events. The period lives in the URL.
export function AdminOverviewPage() {
  const { t } = useT()
  const title = t("dashboard.nav_overview")
  usePageTitle(title)
  const { range } = analyticsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const stats = useQuery(adminQueries.stats(range))
  const setRange = (next: Range) =>
    void navigate({
      to: ".",
      search: next === "30d" ? {} : { range: next },
      replace: true,
      resetScroll: false,
      viewTransition: false,
    })
  const chart = (key: keyof AdminStats["series"], label: string) => ({
    title: label,
    data: rows(stats.data?.series[key]),
    series: [{ key: "value", label }],
    loading: stats.isPending,
    error: stats.isError,
    onRetry: () => void stats.refetch(),
  })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <DateRangeSelect value={range} onChange={setRange} />
      </PageHeader>
      <AdminStatGrid stats={stats} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AreaChartCard
          {...chart("newListings", t("admin.overview_new_listings"))}
        />
        <AreaChartCard {...chart("newUsers", t("admin.overview_new_users"))} />
        <BarChartCard {...chart("revenue", t("admin.overview_revenue_day"))} />
        <QueuesCard />
      </div>
      <ActivityFeed />
    </div>
  )
}
