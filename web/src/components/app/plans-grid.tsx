import { useId } from "react"

import { useT } from "@/lib/i18n/use-t"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import { PlanCard, type PlanRow } from "./plan-card"

type Props = { plans: Plan[]; currentId?: string } & (
  | {
      mode: "select"
      label: string
      value?: string
      onChange: (id: string) => void
    }
  | {
      mode: "action"
      onAction: (id: string) => void
      pendingIds?: string[]
    }
)

// Columns follow the grid's own width (container queries), not the viewport, so a narrow parent stacks the cards instead of squeezing three in. Every card gets the same rows (the union of all plans' features, plus the limit and the featured credits), so on a wide screen the cards line up row by row through CSS subgrid and compare at a glance. The first paid plan is the recommended one.
export function PlansGrid(props: Props) {
  const { t, locale } = useT()
  const name = useId()
  const { plans } = props
  const dealer = plans.some((p) => p.audience === "dealership")
  const features = [
    ...new Set(plans.flatMap((p) => p.features.map((f) => f[locale]))),
  ]
  const rowsOf = (plan: Plan): PlanRow[] => {
    const limit = plan.listingLimit
    const hasLimits = plans.some((p) => p.listingLimit !== undefined)
    return [
      ...(hasLimits
        ? [
            {
              label: t(
                dealer ? "billing.usage_vehicles" : "billing.usage_listings"
              ),
              value:
                limit === undefined ? t("billing.unlimited") : String(limit),
            },
          ]
        : []),
      ...(plans.some((p) => p.featuredCredits > 0)
        ? [
            {
              label: t("billing.row_featured_credits"),
              value:
                plan.featuredCredits > 0
                  ? t("billing.credits_per_month", {
                      count: plan.featuredCredits,
                    })
                  : false,
            },
          ]
        : []),
      ...features.map((label) => ({
        label,
        value: plan.features.some((f) => f[locale] === label),
      })),
    ]
  }
  const recommended = plans.length > 1 ? plans.find((p) => p.price > 0) : null
  const current = plans.find((p) => p.id === props.currentId)
  // Name, price, the rows, the action.
  const span = 3 + (plans[0] ? rowsOf(plans[0]).length : 0)
  return (
    <div className="@container">
      <div
        role={props.mode === "select" ? "radiogroup" : undefined}
        aria-label={props.mode === "select" ? props.label : undefined}
        className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-3"
      >
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            rows={rowsOf(plan)}
            span={span}
            recommended={plan.id === recommended?.id}
            current={plan.id === props.currentId}
            {...(props.mode === "select"
              ? {
                  mode: "select",
                  name,
                  selected: plan.id === props.value,
                  onSelect: props.onChange,
                }
              : {
                  mode: "action",
                  onAction: props.onAction,
                  pending: props.pendingIds?.includes(plan.id),
                  upgrade: plan.price > (current?.price ?? 0),
                })}
          />
        ))}
      </div>
    </div>
  )
}
