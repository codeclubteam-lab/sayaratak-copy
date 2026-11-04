import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminSubscription } from "@sayaratak/shared/schemas/admin"

// Live listings against the cap while the subscription runs.
export function SubscriptionUsage({ sub }: { sub: AdminSubscription }) {
  const { t, locale } = useT()
  if (sub.status !== "active")
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("admin.plan_usage_none")}</span>
      </span>
    )
  if (sub.usage.limit === null)
    return (
      <span className="text-muted-foreground">{t("billing.unlimited")}</span>
    )
  return (
    <span className="num">
      {t("admin.plan_usage", {
        used: formatNumber(sub.usage.used, locale),
        limit: formatNumber(sub.usage.limit, locale),
      })}
    </span>
  )
}
