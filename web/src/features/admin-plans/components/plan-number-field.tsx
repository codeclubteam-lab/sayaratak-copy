import { Controller, type Control } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import type { PlanForm } from "../schemas"

type NumberName =
  | "price"
  | "durationDays"
  | "sortOrder"
  | "listingLimit"
  | "featuredCredits"
  | "serviceLimit"
  | "photoLimit"
  | "portfolioLimit"

// One number of the plan form. `readOnly` keeps a locked value visible and focusable; its hint says why.
export function PlanNumberField({
  control,
  name,
  label,
  hint,
  error,
  max,
  optional,
  readOnly,
}: {
  control: Control<PlanForm>
  name: NumberName
  label: string
  hint?: string
  error?: string
  max: number
  optional?: boolean
  readOnly?: boolean
}) {
  return (
    <FormField
      label={label}
      description={hint}
      error={error}
      optional={optional}
    >
      {(props) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <NumberField
              {...props}
              min={name === "durationDays" ? 1 : 0}
              max={max}
              grouping={name === "price"}
              readOnly={readOnly}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      )}
    </FormField>
  )
}
