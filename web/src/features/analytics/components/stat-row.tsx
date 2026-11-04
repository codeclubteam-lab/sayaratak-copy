import { StatCard } from "@/components/app/stat-card"
import { useT } from "@/lib/i18n/use-t"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

type Role = "dealership" | "workshop" | "mechanic"
type Key = keyof Analytics["totals"]

// A dealership counts listing views and favorites; a workshop or mechanic counts profile views and new reviews.
const stats: Record<Role, { key: Key; label: string }[]> = {
  dealership: [
    { key: "views", label: "analytics.stat_views" },
    { key: "calls", label: "analytics.stat_calls" },
    { key: "whatsapp", label: "analytics.stat_whatsapp" },
    { key: "messages", label: "analytics.stat_messages" },
    { key: "favorites", label: "analytics.stat_favorites" },
  ],
  workshop: [
    { key: "views", label: "analytics.stat_profile_views" },
    { key: "calls", label: "analytics.stat_calls" },
    { key: "whatsapp", label: "analytics.stat_whatsapp" },
    { key: "messages", label: "analytics.stat_messages" },
    { key: "newReviews", label: "analytics.stat_reviews" },
  ],
  mechanic: [
    { key: "views", label: "analytics.stat_profile_views" },
    { key: "calls", label: "analytics.stat_calls" },
    { key: "whatsapp", label: "analytics.stat_whatsapp" },
    { key: "messages", label: "analytics.stat_messages" },
    { key: "newReviews", label: "analytics.stat_reviews" },
  ],
}

// Five cards, each with its change against the period just before.
export function StatRow({
  role,
  data,
  loading,
}: {
  role: Role
  data?: Analytics
  loading?: boolean
}) {
  const { t } = useT()
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {stats[role].map(({ key, label }) => (
        <StatCard
          key={key}
          label={t(label)}
          value={data?.totals[key]}
          previous={data?.previous[key]}
          loading={loading}
        />
      ))}
    </div>
  )
}
