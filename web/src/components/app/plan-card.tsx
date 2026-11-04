import { CheckIcon, MinusIcon } from "lucide-react"

import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// One comparison line: a number or text, or included (true) and not included (false).
export type PlanRow = { label: string; value: string | boolean }

type Props = {
  plan: Plan
  rows: PlanRow[]
  // Grid rows the card spans in its parent, so the cards share rows (subgrid).
  span: number
  recommended: boolean
  current: boolean
} & (
  | {
      mode: "select"
      name: string
      selected: boolean
      onSelect: (id: string) => void
    }
  | {
      mode: "action"
      onAction: (id: string) => void
      // A payment for this plan waits for review: no second payment.
      pending?: boolean
      // Costs more than the current plan: "Upgrade to", else "Switch to".
      upgrade: boolean
    }
)

// "select" is a native radio (arrow keys and grouping for free) for onboarding; "action" is the billing page, where the current plan has no button and the free plan is where a paid plan falls back to.
export function PlanCard(props: Props) {
  const { plan, rows, span, recommended, current } = props
  const { t, locale } = useT()
  const { amount, unit } = formatPrice(plan.price, locale)
  const name = plan.name[locale]
  const highlight =
    props.mode === "select" ? props.selected : recommended && !current
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-title font-semibold">{name}</h3>
        {/* The current plan says so in its action row instead. */}
        {current ? null : props.mode === "select" && plan.price === 0 ? (
          <Badge>{t("billing.start_free")}</Badge>
        ) : (
          recommended && (
            <Badge variant="primary">{t("billing.recommended")}</Badge>
          )
        )}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-1 self-start">
        <span className="text-page font-semibold num">{amount}</span>
        <span className="text-ui text-muted-foreground">
          {unit} /{" "}
          {plan.durationDays === 30
            ? t("billing.per_month")
            : t("billing.duration_days", { count: plan.durationDays })}
        </span>
      </p>
      {rows.map((row) => (
        <p
          key={row.label}
          className="flex items-center justify-between gap-3 border-t border-border pt-2 text-ui"
        >
          <span className="text-muted-foreground">{row.label}</span>
          {typeof row.value === "string" ? (
            <span className="font-medium num">{row.value}</span>
          ) : row.value ? (
            <CheckIcon
              aria-label={t("billing.included")}
              className="size-4 shrink-0 text-primary"
            />
          ) : (
            <MinusIcon
              aria-label={t("billing.not_included")}
              className="size-4 shrink-0 text-muted-foreground"
            />
          )}
        </p>
      ))}
    </>
  )
  const card = cn(
    "grid grid-rows-subgrid gap-3 rounded-xl bg-card p-5",
    highlight && "ring-2 ring-primary"
  )
  if (props.mode === "action")
    return (
      <div className={card} style={{ gridRow: `span ${span}` }}>
        {body}
        <div className="flex items-end pt-2">
          {current ? (
            <p className="flex items-center gap-2 text-ui font-medium text-primary">
              <CheckIcon aria-hidden="true" className="size-4" />
              {t("billing.your_current_plan")}
            </p>
          ) : props.pending ? (
            <Button type="button" className="w-full" disabled>
              {t("billing.pending_badge")}
            </Button>
          ) : plan.price === 0 ? (
            <p className="text-caption text-muted-foreground">
              {t("billing.free_fallback")}
            </p>
          ) : (
            <Button
              type="button"
              className="w-full"
              variant={props.upgrade ? "default" : "outline"}
              onClick={() => props.onAction(plan.id)}
            >
              {t(props.upgrade ? "billing.upgrade_to" : "billing.switch_to", {
                name,
              })}
            </Button>
          )}
        </div>
      </div>
    )
  return (
    <label
      className={cn(
        card,
        "cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-ring"
      )}
      style={{ gridRow: `span ${span}` }}
    >
      <input
        type="radio"
        name={props.name}
        value={plan.id}
        checked={props.selected}
        onChange={() => props.onSelect(plan.id)}
        className="size-4 accent-primary"
      />
      {body}
    </label>
  )
}
