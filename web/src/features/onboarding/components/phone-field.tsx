import { Controller, useFormContext } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { PhoneInput } from "@/components/app/phone-input"
import { useT } from "@/lib/i18n/use-t"

// The one required phone of a workshop or a mechanic.
export function PhoneField() {
  const { t } = useT()
  const { control } = useFormContext<{ phone: string }>()
  return (
    <Controller
      control={control}
      name="phone"
      render={({ field, fieldState }) => (
        <FormField label={t("form.phone")} error={fieldState.error?.message}>
          {(c) => (
            <PhoneInput
              {...c}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        </FormField>
      )}
    />
  )
}
