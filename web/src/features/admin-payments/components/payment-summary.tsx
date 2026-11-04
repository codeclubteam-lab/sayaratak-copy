import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminPaymentsPage } from "@sayaratak/shared/schemas/responses"
import { StatCard } from "@/components/app/stat-card"

// Three numbers above the table: approved this month (Khartoum calendar), how many wait and how much they add up to.
export function PaymentSummary({
  summary,
}: {
  summary: AdminPaymentsPage["summary"] | undefined
}) {
  const { t, locale } = useT()
  const { unit } = formatPrice(0, locale)
  return (
    <section
      aria-label={t("admin.payments_summary")}
      className="grid gap-3 sm:grid-cols-3"
    >
      <StatCard
        label={t("admin.payments_approved_month")}
        value={summary?.approvedThisMonth}
        detail={unit}
      />
      <StatCard
        label={t("admin.payments_pending_count")}
        value={summary?.pendingCount}
      />
      <StatCard
        label={t("admin.payments_pending_amount")}
        value={summary?.pendingAmount}
        detail={unit}
      />
    </section>
  )
}
