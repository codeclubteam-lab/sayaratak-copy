import { useEffect, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import { formatNumber } from "@/lib/format"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { adminQueries } from "@/features/admin/queries"
import { assignPlanSchema, type AssignPlanForm } from "@/features/admin/schemas"
import { FieldMarks, FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SelectInput } from "@/components/app/select-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppForm } from "@/hooks/use-app-form"

type NumberName = "customPrice" | "customLimit" | "durationDays"

// A plan of this business's type with optional custom price, limit (dealerships only, workshops and mechanics post no listings) and length; an empty field keeps the plan's value, shown as its hint. Most fields are optional, so the required one carries the mark.
export function AssignPlanDialog({
  open,
  onOpenChange,
  business,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  business: AdminBusiness
  pending?: boolean
  onConfirm: (value: AssignPlanForm) => void
}) {
  const { t, locale } = useT()
  const plans = (useQuery(adminQueries.plans).data ?? []).filter(
    (p) => p.audience === business.type
  )
  const form = useAppForm<AssignPlanForm>({
    resolver: zodResolver(assignPlanSchema),
    mode: "onTouched",
    defaultValues: {
      planId: business.plan.id,
      customPrice: null,
      customLimit: null,
      durationDays: null,
      note: "",
    },
  })
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])
  const { errors } = form.formState
  const plan = plans.find((p) => p.id === form.watch("planId"))
  const planLimit = plan?.listingLimit
  const number = (
    name: NumberName,
    label: string,
    max: number,
    hint: string | undefined
  ): ReactNode => (
    <FormField
      label={label}
      description={hint}
      error={errors[name]?.message}
      optional
    >
      {(control) => (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <NumberField
              {...control}
              min={name === "durationDays" ? 1 : 0}
              max={max}
              grouping={name === "customPrice"}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      )}
    </FormField>
  )
  const planHint = (value: number | undefined, key: string) =>
    value === undefined
      ? undefined
      : t(key, { value: formatNumber(value, locale) })
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.business_assign_title", {
        name: business.name[locale],
      })}
      description={t("admin.business_assign_body")}
    >
      <FieldMarks value="required">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onConfirm)}
        >
          <FormField
            label={t("admin.business_col_plan")}
            error={errors.planId?.message}
          >
            {(control) => (
              <Controller
                control={form.control}
                name="planId"
                render={({ field }) => (
                  <SelectInput
                    {...control}
                    value={field.value}
                    onChange={field.onChange}
                    options={plans.map((p) => ({
                      value: p.id,
                      label: p.name[locale],
                    }))}
                  />
                )}
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {number(
              "customPrice",
              t("admin.business_custom_price"),
              9_999_999_999,
              planHint(plan?.price, "admin.business_plan_price_hint")
            )}
            {number(
              "durationDays",
              t("admin.business_custom_days"),
              730,
              planHint(plan?.durationDays, "admin.business_plan_days_hint")
            )}
            {business.type === "dealership" &&
              number(
                "customLimit",
                t("admin.business_custom_limit"),
                10000,
                planLimit === undefined
                  ? t("admin.business_plan_no_limit_hint")
                  : planHint(planLimit, "admin.business_plan_limit_hint")
              )}
          </div>
          <FormField
            label={t("admin.business_assign_note")}
            error={errors.note?.message}
            optional
          >
            {(control) => (
              <Input {...control} maxLength={200} {...form.register("note")} />
            )}
          </FormField>
          <p aria-hidden="true" className="text-caption text-muted-foreground">
            {t("form.required_note")}
          </p>
          <div className="flex flex-wrap gap-3">
            <SubmitButton pending={pending}>
              {t("admin.business_assign_plan")}
            </SubmitButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </FieldMarks>
    </ResponsiveDialog>
  )
}
