import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminSubscription } from "@sayaratak/shared/schemas/admin"
import { SubscriberLink } from "./subscriber-link"
import { SubscriptionStatusBadge } from "./subscription-status-badge"
import { SubscriptionUsage } from "./subscription-usage"

// One subscription below md: holder and status, plan, dates, usage.
export function SubscriberCard({ sub }: { sub: AdminSubscription }) {
  const { t, locale } = useT()
  return (
    <article className="flex flex-col gap-1 border-b p-3 in-[li:last-child]:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubscriberLink sub={sub} />
        <SubscriptionStatusBadge status={sub.status} />
      </div>
      <p className="text-ui">
        <bdi>{sub.plan.name[locale]}</bdi>
        <span className="text-muted-foreground">
          {" · "}
          {t(`admin.plans_tab_${sub.plan.audience}`)}
        </span>
      </p>
      <p className="text-caption text-muted-foreground">
        {t("admin.plan_dates", {
          starts: formatDate(sub.startsAt, locale),
          ends: formatDate(sub.endsAt, locale),
        })}
      </p>
      <p className="flex gap-1 text-caption">
        <span className="text-muted-foreground">
          {t("admin.plan_col_usage")}
        </span>
        <SubscriptionUsage sub={sub} />
      </p>
    </article>
  )
}
