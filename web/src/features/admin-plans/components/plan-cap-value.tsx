import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import type { CapKey } from "./plan-caps"

// A cap as a number, or "No limit" when the plan has none.
export function PlanCapValue({ plan, cap }: { plan: Plan; cap: CapKey }) {
  const { t, locale } = useT()
  const value = plan[cap]
  return value === undefined ? (
    <span className="text-muted-foreground">{t("billing.unlimited")}</span>
  ) : (
    <span className="num">{formatNumber(value, locale)}</span>
  )
}
