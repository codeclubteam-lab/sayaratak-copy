import { useId } from "react"

import { PriceText } from "@/components/app/price-text"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import type { MeSubscription } from "@sayaratak/shared/schemas/responses"
import { PlanSummary } from "./plan-summary"

// The plan the account runs on, on the billing page: the shared summary with the price and the way to the history.
export function CurrentPlanCard({
  data,
  freePlan,
  audience,
  onHistory,
}: {
  data: MeSubscription
  freePlan?: Plan
  audience: Plan["audience"]
  onHistory: () => void
}) {
  const { t } = useT()
  const heading = useId()
  const plan = data.plan ?? freePlan
  return (
    <section
      aria-labelledby={heading}
      className="flex flex-col gap-4 rounded-xl bg-card p-5"
    >
      <PlanSummary
        data={data}
        plan={plan}
        audience={audience}
        headingId={heading}
        end={
          plan && plan.price > 0 ? (
            <PriceText
              price={data.subscription?.price ?? plan.price}
              size="table"
            />
          ) : null
        }
      />
      <Button
        type="button"
        variant="link"
        className="self-start px-0"
        onClick={onHistory}
      >
        {t("billing.view_history")}
      </Button>
    </section>
  )
}
