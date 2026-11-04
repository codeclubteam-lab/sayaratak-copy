import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { PlanActions } from "./plan-actions"
import { PlanCapValue } from "./plan-cap-value"
import { capHeader, capsOf } from "./plan-caps"
import { PlanEnabledSwitch } from "./plan-enabled-switch"
import { PlanNameCell } from "./plan-name-cell"
import { PlanPrice } from "./plan-price"

// One plan below md: name, price and length, caps and subscribers, the switch with its label, then Edit and Remove (or why it stays).
export function AdminPlanCard({
  plan,
  onEdit,
}: {
  plan: AdminPlan
  onEdit: () => void
}) {
  const { t, locale } = useT()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <PlanNameCell plan={plan} />
      <p className="flex flex-wrap items-baseline gap-x-2 text-ui">
        <PlanPrice price={plan.price} />
        <span className="text-muted-foreground">
          {t("billing.duration_days", { count: plan.durationDays })}
        </span>
      </p>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-caption">
        {capsOf[plan.audience].map((cap) => (
          <div key={cap} className="flex gap-1">
            <dt className="text-muted-foreground">
              {t(capHeader(plan.audience, cap))}
            </dt>
            <dd>
              <PlanCapValue plan={plan} cap={cap} />
            </dd>
          </div>
        ))}
        <div className="flex gap-1">
          <dt className="text-muted-foreground">
            {t("admin.plan_col_subscribers")}
          </dt>
          <dd className="num">{formatNumber(plan.subscribers, locale)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-ui">
          <PlanEnabledSwitch plan={plan} />
          <span aria-hidden="true">{t("admin.plan_col_enabled")}</span>
        </span>
        <PlanActions plan={plan} onEdit={onEdit} />
      </div>
    </article>
  )
}
