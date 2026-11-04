import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { adminQueries } from "@/features/admin/queries"
import {
  plansSearchSchema,
  subscriptionStatuses,
  type PlansSearch,
} from "@/features/admin/schemas"
import { SelectInput } from "@/components/app/select-input"

const audiences = ["user", "dealership", "workshop", "mechanic"] as const

// Audience, plan (narrowed to the audience when one is picked) and status. Clearing one drops it from the URL; a new audience clears a plan of another.
export function SubscriberFilters({
  search,
  onChange,
}: {
  search: PlansSearch
  onChange: (next: Partial<PlansSearch>) => void
}) {
  const { t, locale } = useT()
  const { data: plans } = useQuery(adminQueries.plans)
  const { audience, status } = plansSearchSchema.shape
  return (
    <>
      <SelectInput
        className="w-40"
        aria-label={t("admin.plan_audience_filter")}
        placeholder={t("admin.plan_audience_filter")}
        value={search.audience ?? ""}
        options={audiences.map((a) => ({
          value: a,
          label: t(`admin.plans_tab_${a}`),
        }))}
        onChange={(next) => {
          const picked = audience.parse(next || undefined)
          const plan = plans?.find((p) => p.id === search.planId)
          onChange({
            audience: picked,
            planId:
              picked && plan && plan.audience !== picked
                ? undefined
                : search.planId,
          })
        }}
      />
      <SelectInput
        className="w-44"
        aria-label={t("admin.business_col_plan")}
        placeholder={t("admin.business_col_plan")}
        value={search.planId ?? ""}
        options={(plans ?? [])
          .filter((p) => !search.audience || p.audience === search.audience)
          .map((p) => ({
            value: p.id,
            label: `${p.name[locale]} · ${t(`admin.plans_tab_${p.audience}`)}`,
          }))}
        onChange={(next) => onChange({ planId: next || undefined })}
      />
      <SelectInput
        className="w-40"
        aria-label={t("admin.report_col_status")}
        placeholder={t("admin.report_col_status")}
        value={search.status ?? ""}
        options={subscriptionStatuses.map((s) => ({
          value: s,
          label: t(`billing.status_${s}`),
        }))}
        onChange={(next) =>
          onChange({ status: status.parse(next || undefined) })
        }
      />
    </>
  )
}
