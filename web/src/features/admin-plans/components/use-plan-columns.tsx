import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { PlanActions } from "./plan-actions"
import { PlanCapValue } from "./plan-cap-value"
import { capHeader, capsOf } from "./plan-caps"
import { PlanEnabledSwitch } from "./plan-enabled-switch"
import { PlanNameCell } from "./plan-name-cell"
import { PlanPrice } from "./plan-price"

const end = { align: "end" } as const

// Name, price, length, this audience's caps, active subscribers, on or off, order, actions. Numbers line up at the end. A few rows, so every column stays (no Columns menu).
export function usePlanColumns(
  audience: AdminPlan["audience"],
  onEdit: (plan: AdminPlan) => void
): DataColumn<AdminPlan>[] {
  const { t, locale } = useT()
  const columns: DataColumn<AdminPlan>[] = [
    {
      id: "name",
      header: t("admin.plan_col_name"),
      cell: ({ row }) => <PlanNameCell plan={row.original} />,
    },
    {
      id: "price",
      header: t("admin.plan_col_price"),
      meta: end,
      cell: ({ row }) => <PlanPrice price={row.original.price} />,
    },
    {
      id: "duration",
      header: t("admin.plan_col_duration"),
      meta: end,
      cell: ({ row }) =>
        t("billing.duration_days", { count: row.original.durationDays }),
    },
    ...capsOf[audience].map((cap): DataColumn<AdminPlan> => ({
      id: cap,
      header: t(capHeader(audience, cap)),
      meta: end,
      cell: ({ row }) => <PlanCapValue plan={row.original} cap={cap} />,
    })),
    {
      id: "subscribers",
      header: t("admin.plan_col_subscribers"),
      meta: end,
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.subscribers, locale)}
        </span>
      ),
    },
    {
      id: "enabled",
      header: t("admin.plan_col_enabled"),
      cell: ({ row }) => <PlanEnabledSwitch plan={row.original} />,
    },
    {
      id: "order",
      header: t("admin.plan_col_order"),
      meta: end,
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.sortOrder, locale)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("admin.plan_col_actions"),
      cell: ({ row }) => (
        <PlanActions plan={row.original} onEdit={() => onEdit(row.original)} />
      ),
    },
  ]
  return columns.map((c) => ({ ...c, enableHiding: false }))
}
