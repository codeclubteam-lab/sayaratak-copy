import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { StatCard } from "@/components/app/stat-card"
import { billingQueries } from "@/features/billing/queries"
import { businessQueries } from "@/features/directory/queries"
import { countsQuery } from "@/features/notifications/counts-query"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

// Five numbers, each a link to the page that explains it. Views and contacts follow the range; the others are counts of now.
export function DealerStats({
  range,
  analytics,
}: {
  range: Range
  analytics: UseQueryResult<Analytics>
}) {
  const { t, locale } = useT()
  const subscription = useQuery(billingQueries.subscription)
  const counts = useQuery(countsQuery)
  const business = useQuery(businessQueries.mine)
  const queries = [analytics, subscription, counts, business]
  if (queries.some((q) => q.isError))
    return (
      <SectionError
        message={t("dashboard.overview_stats_error")}
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />
    )
  const totals = analytics.data?.totals
  const previous = analytics.data?.previous
  const usage = subscription.data?.usage
  const rating =
    business.data && "rating" in business.data
      ? business.data.rating
      : undefined
  const toAnalytics = {
    to: "/$locale/dealer/analytics",
    params: { locale },
    search: { range },
  } as const
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label={t("dashboard.dealer_stat_active")}
        value={usage?.used}
        detail={
          usage?.limit != null
            ? t("dashboard.dealer_of_limit", {
                max: formatNumber(usage.limit, locale),
              })
            : undefined
        }
        link={{
          to: "/$locale/dealer/inventory",
          params: { locale },
          search: { tab: "active" },
        }}
      />
      <StatCard
        label={t("analytics.stat_views")}
        value={totals?.views}
        previous={previous?.views}
        link={toAnalytics}
      />
      <StatCard
        label={t("analytics.col_contacts")}
        value={totals && totals.calls + totals.whatsapp}
        previous={previous && previous.calls + previous.whatsapp}
        link={toAnalytics}
      />
      <StatCard
        label={t("dashboard.overview_stat_messages")}
        value={counts.data?.unreadMessages}
        link={{ to: "/$locale/dealer/messages", params: { locale } }}
      />
      <StatCard
        label={t("dashboard.dealer_stat_rating")}
        // One decimal, like the stars on the public profile.
        value={rating && Math.round(rating.avg * 10) / 10}
        detail={rating && t("directory.reviews_count", { count: rating.count })}
        link={{ to: "/$locale/dealer/reviews", params: { locale } }}
      />
    </div>
  )
}
