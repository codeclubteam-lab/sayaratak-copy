import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { AreaChartCard } from "@/components/app/area-chart-card"
import { DateRangeSelect } from "@/components/app/date-range-select"
import { PageHeader } from "@/components/app/page-header"
import { AvailabilityCard } from "@/features/mechanic-overview/components/availability-card"
import { WelcomeNotice } from "@/features/account-overview/components/welcome-notice"
import { overviewSearchSchema } from "@/features/account-overview/schemas"
import { analyticsQuery } from "@/features/analytics/queries"
import { analyticsSearchSchema } from "@/features/analytics/schemas"
import { SubscriptionCard } from "@/features/billing/components/subscription-card"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { SetupChecklist } from "@/features/onboarding/components/setup-checklist"
import { RecentReviewsCard } from "@/features/reviews/components/recent-reviews-card"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import { WorkshopStats } from "./workshop-stats"

// The first screen of a workshop or a mechanic: availability (mechanic only), setup until done, five numbers, profile views over the period, the newest reviews with a reply in place, and the plan. The period lives in the URL.
export function WorkshopOverviewPage({
  role = "workshop",
}: {
  role?: "workshop" | "mechanic"
}) {
  const { t } = useT()
  const title = t("dashboard.nav_overview")
  usePageTitle(title)
  const search = useSearch({ strict: false })
  const { range } = analyticsSearchSchema.parse(search)
  const { welcome } = overviewSearchSchema.parse(search)
  const navigate = useNavigate()
  const analytics = useQuery(analyticsQuery(range))
  const setRange = (next: Range) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        range: next === "30d" ? undefined : next,
      }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <DateRangeSelect value={range} onChange={setRange} />
      </PageHeader>
      {welcome === 1 && <WelcomeNotice role={role} />}
      {role === "mechanic" && <AvailabilityCard />}
      <SetupChecklist />
      <WorkshopStats role={role} range={range} analytics={analytics} />
      {!analytics.isError && (
        <AreaChartCard
          title={t("analytics.chart_profile_views")}
          series={[{ key: "views", label: t("analytics.series_views") }]}
          data={analytics.data?.daily.map(({ date, views }) => ({
            day: date,
            views,
          }))}
          loading={analytics.isPending}
        />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <RecentReviewsCard targetType={role} />
        <SubscriptionCard role={role} />
      </div>
    </div>
  )
}
