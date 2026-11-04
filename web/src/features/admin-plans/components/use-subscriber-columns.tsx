import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { AdminSubscription } from "@sayaratak/shared/schemas/admin"
import { SubscriberLink } from "./subscriber-link"
import { SubscriptionStatusBadge } from "./subscription-status-badge"
import { SubscriptionUsage } from "./subscription-usage"

// Holder, plan, status, start, end and usage; newest first from the server, so no column sorts.
export function useSubscriberColumns(): DataColumn<AdminSubscription>[] {
  const { t, locale } = useT()
  return [
    {
      id: "subscriber",
      header: t("admin.plan_col_subscriber"),
      enableHiding: false,
      cell: ({ row }) => <SubscriberLink sub={row.original} />,
    },
    {
      id: "plan",
      header: t("admin.business_col_plan"),
      cell: ({ row }) => (
        <span className="flex flex-col">
          <bdi>{row.original.plan.name[locale]}</bdi>
          <span className="text-caption text-muted-foreground">
            {t(`admin.plans_tab_${row.original.plan.audience}`)}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: t("admin.report_col_status"),
      cell: ({ row }) => (
        <SubscriptionStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "starts",
      header: t("admin.plan_col_starts"),
      cell: ({ row }) => formatDate(row.original.startsAt, locale),
    },
    {
      id: "ends",
      header: t("admin.plan_col_ends"),
      cell: ({ row }) => formatDate(row.original.endsAt, locale),
    },
    {
      id: "usage",
      header: t("admin.plan_col_usage"),
      cell: ({ row }) => <SubscriptionUsage sub={row.original} />,
    },
  ]
}
