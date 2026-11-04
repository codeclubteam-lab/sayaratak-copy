import { useId } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"

import { useT } from "@/lib/i18n/use-t"
import type { AdminPlan } from "@sayaratak/shared/schemas/admin"
import { FormField } from "@/components/app/form-field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { PlanForm } from "../schemas"
import { capLabel, capsOf } from "./plan-caps"
import { PlanFeaturesField } from "./plan-features-field"
import { PlanNumberField } from "./plan-number-field"

const capMax = {
  listingLimit: 10000,
  featuredCredits: 99,
  serviceLimit: 1000,
  photoLimit: 100,
  portfolioLimit: 1000,
}

// Names, price and length, the audience's caps, order and the on switch, then the feature lines. The free plan keeps its price and stays on; the individuals' free limit comes from the settings above the tabs.
export function PlanFormFields({
  form,
  plan,
}: {
  form: UseFormReturn<PlanForm>
  plan?: AdminPlan
}) {
  const { t } = useT()
  const id = useId()
  const { errors } = form.formState
  const audience = form.watch("audience")
  const free = !!plan?.free
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={t("admin.plan_name_ar")}
          error={errors.nameAr?.message}
        >
          {(props) => (
            <Input
              {...props}
              dir="rtl"
              lang="ar"
              maxLength={40}
              {...form.register("nameAr")}
            />
          )}
        </FormField>
        <FormField
          label={t("admin.plan_name_en")}
          error={errors.nameEn?.message}
        >
          {(props) => (
            <Input
              {...props}
              dir="ltr"
              lang="en"
              maxLength={40}
              {...form.register("nameEn")}
            />
          )}
        </FormField>
        <PlanNumberField
          control={form.control}
          name="price"
          label={t("admin.plan_price")}
          hint={t(
            free ? "admin.plan_price_free_hint" : "admin.plan_price_hint"
          )}
          error={errors.price?.message}
          max={9_999_999_999}
          readOnly={free}
        />
        <PlanNumberField
          control={form.control}
          name="durationDays"
          label={t("admin.plan_days")}
          error={errors.durationDays?.message}
          max={730}
        />
        {capsOf[audience].map((cap) => {
          const fromSettings =
            free && audience === "user" && cap === "listingLimit"
          const required = cap === "listingLimit" || cap === "featuredCredits"
          return (
            <PlanNumberField
              key={cap}
              control={form.control}
              name={cap}
              label={t(capLabel(audience, cap))}
              hint={
                fromSettings
                  ? t("admin.plan_limit_from_settings")
                  : required
                    ? undefined
                    : t("admin.plan_cap_empty_hint")
              }
              error={errors[cap]?.message}
              max={capMax[cap]}
              optional={!required}
              readOnly={fromSettings}
            />
          )
        })}
        <PlanNumberField
          control={form.control}
          name="sortOrder"
          label={t("admin.plan_order")}
          hint={t("admin.plan_order_hint")}
          error={errors.sortOrder?.message}
          max={999}
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span id={`${id}-on`} className="text-ui font-medium">
            {t("admin.plan_enabled")}
          </span>
          <span
            id={`${id}-on-hint`}
            className="text-caption text-muted-foreground"
          >
            {t(free ? "admin.plan_free_locked" : "admin.plan_enabled_hint")}
          </span>
        </div>
        <Controller
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <Switch
              aria-labelledby={`${id}-on`}
              aria-describedby={`${id}-on-hint`}
              checked={field.value}
              disabled={free}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
      <PlanFeaturesField form={form} />
    </>
  )
}
