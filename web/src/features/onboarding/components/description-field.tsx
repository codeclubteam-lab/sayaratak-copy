import { useFormContext, useWatch } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { Textarea } from "@/components/ui/textarea"

type Name = "description" | "bio"

// The about text of a business (`description`) or a mechanic (`bio`), with a live character counter.
export function DescriptionField({
  label,
  max = 1000,
  name = "description",
}: {
  label: string
  max?: number
  name?: Name
}) {
  const { register, control, formState } =
    useFormContext<Record<Name, string>>()
  const length = useWatch({ control, name }).length
  return (
    <FormField
      label={label}
      error={formState.errors[name]?.message}
      description={`${length}/${max}`}
    >
      {(c) => <Textarea {...c} {...register(name)} rows={5} />}
    </FormField>
  )
}
