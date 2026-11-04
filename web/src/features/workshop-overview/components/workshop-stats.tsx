import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { StatCard } from "@/components/app/stat-card"
import { businessQueries } from "@/features/directory/queries"
import { countsQuery } from "@/features/notifications/counts-query"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

const paths = {
  workshop: {
    analytics: "/$locale/workshop/analytics",
    inquiries: "/$locale/workshop/inquiries",
    reviews: "/$locale/workshop/reviews",
  },
  mechanic: {
    analytics: "/$locale/mechanic/analytics",
    inquiries: "/$locale/mechanic/inquiries",
    reviews: "/$locale/mechanic/reviews",
  },
} as const

// Five numbers on the workshop and mechanic overviews, each a link to the page that explains it. Views and contacts follow the range; unread inquiries and the rating are counts of now.
export function WorkshopStats({
  role = "workshop",
  range,
  analytics,
}: {
  role?: "workshop" | "mechanic"
  range: Range
  analytics: UseQueryResult<Analytics>
}) {
  const { t, locale } = useT()
  const counts = useQuery(countsQuery)
  const business = useQuery(businessQueries.mine)
  const queries = [analytics, counts, business]
  if (queries.some((q) => q.isError))
    return (
      <SectionError
        message={t("dashboard.overview_stats_error")}
        onRetry={() => queries.forEach((q) => void q.refetch())}
      />
    )
  const totals = analytics.data?.totals
  const previous = analytics.data?.previous
  const rating =
    business.data && "rating" in business.data
      ? business.data.rating
      : undefined
  const toAnalytics = {
    to: paths[role].analytics,
    params: { locale },
    search: { range },
  } as const
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label={t("analytics.stat_profile_views")}
        value={totals?.views}
        previous={previous?.views}
        link={toAnalytics}
      />
      <StatCard
        label={t("analytics.stat_calls")}
        value={totals?.calls}
        previous={previous?.calls}
        link={toAnalytics}
      />
      <StatCard
        label={t("analytics.stat_whatsapp")}
        value={totals?.whatsapp}
        previous={previous?.whatsapp}
        link={toAnalytics}
      />
      <StatCard
        label={t("dashboard.workshop_stat_inquiries")}
        value={counts.data?.unreadMessages}
        link={{ to: paths[role].inquiries, params: { locale } }}
      />
      <StatCard
        label={t("dashboard.dealer_stat_rating")}
        // One decimal, like the stars on the public profile.
        value={rating && Math.round(rating.avg * 10) / 10}
        detail={rating && t("directory.reviews_count", { count: rating.count })}
        link={{ to: paths[role].reviews, params: { locale } }}
      />
    </div>
  )
}
