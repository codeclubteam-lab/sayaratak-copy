import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { FormField } from "./form-field"
import { SelectInput } from "./select-input"

// Options come from the taxonomy, which route loaders prefetch.
export function CitySelect({
  value,
  onChange,
  error,
  label,
  optional,
  disabled,
}: {
  value: string
  onChange: (cityId: string) => void
  error?: string
  label?: string
  optional?: boolean
  disabled?: boolean
}) {
  const { t, locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  return (
    <FormField
      label={label ?? t("form.city")}
      error={error}
      optional={optional}
    >
      {(control) => (
        <SelectInput
          {...control}
          disabled={disabled}
          value={value}
          onChange={onChange}
          placeholder={t("form.select_city")}
          options={(data?.cities ?? []).map((c) => ({
            value: c.id,
            label: c.name[locale],
          }))}
        />
      )}
    </FormField>
  )
}
