import type { UseQueryResult } from "@tanstack/react-query"

import { SectionError } from "@/components/app/section-error"
import { StatCard } from "@/components/app/stat-card"
import { useT } from "@/lib/i18n/use-t"
import type { AdminStats } from "@sayaratak/shared/schemas/responses"

// Two rows of four site totals, each a link to the screen that lists what it counts. Only revenue follows the period; the rest are counts of now.
export function AdminStatGrid({
  stats,
}: {
  stats: UseQueryResult<AdminStats>
}) {
  const { t, locale } = useT()
  if (stats.isError)
    return (
      <SectionError
        message={t("dashboard.overview_stats_error")}
        onRetry={() => void stats.refetch()}
      />
    )
  const totals = stats.data?.totals
  const params = { locale }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label={t("admin.overview_users")}
        value={totals?.users}
        link={{ to: "/$locale/admin/users", params }}
      />
      <StatCard
        label={t("admin.overview_listings")}
        value={totals?.listings}
        link={{
          to: "/$locale/admin/listings",
          params,
          search: { tab: "approved" },
        }}
      />
      <StatCard
        label={t("admin.overview_vehicles")}
        value={totals?.vehicles}
        link={{
          to: "/$locale/admin/listings",
          params,
          search: { tab: "approved", type: "vehicle" },
        }}
      />
      <StatCard
        label={t("dashboard.nav_dealerships")}
        value={totals?.dealerships}
        link={{ to: "/$locale/admin/dealerships", params }}
      />
      <StatCard
        label={t("dashboard.nav_workshops")}
        value={totals?.workshops}
        link={{ to: "/$locale/admin/workshops", params }}
      />
      <StatCard
        label={t("dashboard.nav_mechanics")}
        value={totals?.mechanics}
        link={{ to: "/$locale/admin/mechanics", params }}
      />
      <StatCard
        label={t("admin.overview_subscriptions")}
        value={totals?.activeSubscriptions}
        link={{
          to: "/$locale/admin/plans",
          params,
          search: { tab: "subscribers" },
        }}
      />
      <StatCard
        label={t("admin.overview_revenue")}
        value={totals?.revenue}
        link={{
          to: "/$locale/admin/payments",
          params,
          search: { tab: "approved" },
        }}
      />
    </div>
  )
}
