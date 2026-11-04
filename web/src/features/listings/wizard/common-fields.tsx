import { useFormContext } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { PriceFields } from "@/components/app/price-fields"
import { RentPeriodSelect } from "@/components/app/rent-period-select"
import { Input } from "@/components/ui/input"
import { DescriptionField } from "@/features/onboarding/components/description-field"
import { useT } from "@/lib/i18n/use-t"
import { useStepFields } from "./use-step-fields"

// Title, description and price: what every listing has, vehicle or part, for sale or for rent. Each is a cell of the section's grid.
export function TitleField() {
  const { t } = useT()
  const { register } = useFormContext()
  const { error } = useStepFields()
  return (
    <FormField
      label={t("form.title")}
      error={error("title")}
      className="col-span-full"
    >
      {(control) => <Input {...control} {...register("title")} dir="auto" />}
    </FormField>
  )
}

export function DescriptionBlock() {
  const { t } = useT()
  return (
    <div className="col-span-full">
      <DescriptionField label={t("form.description")} max={2000} />
    </div>
  )
}

export function PriceBlock() {
  const { values, error, set } = useStepFields()
  return (
    <>
      <PriceFields
        value={{ price: values.price, negotiable: values.negotiable }}
        onChange={(next) => {
          set("price", next.price)
          set("negotiable", next.negotiable)
        }}
        error={error("price")}
      />
      {values.intent === "rent" && (
        <RentPeriodSelect
          value={values.rentPeriod}
          onChange={(v) => set("rentPeriod", v)}
          error={error("rentPeriod")}
        />
      )}
    </>
  )
}
