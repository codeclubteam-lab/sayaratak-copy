import { useQuery } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { StatCard } from "@/components/app/stat-card"
import { analyticsQuery } from "@/features/analytics/queries"
import { listingQueries } from "@/features/listings/queries"
import { countsQuery } from "@/features/notifications/counts-query"
import { useT } from "@/lib/i18n/use-t"

// Four numbers. Views and favorites come with their change against the 30 days before; the active count is the same one the listings table's Active tab shows.
export function OverviewStats() {
  const { t } = useT()
  const analytics = useQuery(analyticsQuery("30d"))
  const active = useQuery(listingQueries.mine({ tab: "active", pageSize: 1 }))
  const counts = useQuery(countsQuery)
  const failed = analytics.isError || active.isError || counts.isError
  if (failed)
    return (
      <SectionError
        message={t("dashboard.overview_stats_error")}
        onRetry={() => {
          void analytics.refetch()
          void active.refetch()
          void counts.refetch()
        }}
      />
    )
  const totals = analytics.data?.totals
  const previous = analytics.data?.previous
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label={t("dashboard.overview_stat_active")}
        value={active.data?.total}
      />
      <StatCard
        label={t("dashboard.overview_stat_views")}
        value={totals?.views}
        previous={previous?.views}
      />
      <StatCard
        label={t("dashboard.overview_stat_favorites")}
        value={totals?.favorites}
        previous={previous?.favorites}
      />
      <StatCard
        label={t("dashboard.overview_stat_messages")}
        value={counts.data?.unreadMessages}
      />
    </div>
  )
}
