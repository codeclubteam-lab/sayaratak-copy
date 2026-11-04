import { useFormContext, useWatch } from "react-hook-form"

import { inapplicable } from "./field-rules"

// What every wizard step reads from the one form: the live values, the translated error key of a field, and a setter that re-checks a field already showing an error as it changes, so the error goes as soon as it is fixed. After a change, any details field that no longer applies (New empties the mileage, "not registered" empties the plate) goes back to empty.
export function useStepFields() {
  const { control, setValue, getValues, formState } = useFormContext()
  const values = useWatch({ control })
  const { errors } = formState
  const error = (field: string) => {
    const message = errors[field]?.message
    return typeof message === "string" ? message : undefined
  }
  const set = (field: string, value: unknown) => {
    setValue(field, value, { shouldValidate: field in errors })
    for (const [name, empty] of Object.entries(inapplicable(getValues())))
      setValue(name, empty)
  }
  return { values, error, set }
}
