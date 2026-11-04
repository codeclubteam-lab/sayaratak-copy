import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext, useWatch } from "react-hook-form"

import { FieldError } from "@/components/app/field-error"
import { PlansGrid } from "@/components/app/plans-grid"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { billingQueries } from "@/features/billing/queries"
import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import type { PlanStep as PlanValues } from "../schemas"

// The audience's plans; its free plan is preselected so finishing needs no choice.
export function PlanStep({
  audience,
}: {
  audience: "dealership" | "workshop" | "mechanic"
}) {
  const { t } = useT()
  const { control, setValue } = useFormContext<PlanValues>()
  const planId = useWatch({ control, name: "planId" })
  const plans = useQuery(billingQueries.plans(audience))
  const waiting = useDelayedFlag(plans.isPending)
  const free = plans.data?.find((p) => p.price === 0)
  useEffect(() => {
    if (free && !planId) setValue("planId", free.id)
  }, [free, planId, setValue])
  if (plans.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-ui text-destructive">
          {t("onboarding.plans_error")}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => plans.refetch()}
        >
          {t("common.retry")}
        </Button>
      </div>
    )
  if (!plans.data)
    return waiting ? <Skeleton className="h-64 w-full rounded-xl" /> : null
  return (
    <Controller
      control={control}
      name="planId"
      render={({ field, fieldState }) => (
        <>
          <PlansGrid
            mode="select"
            plans={plans.data}
            label={t("onboarding.plans_label")}
            value={field.value}
            onChange={field.onChange}
          />
          <FieldError message={fieldState.error?.message} />
        </>
      )}
    />
  )
}
