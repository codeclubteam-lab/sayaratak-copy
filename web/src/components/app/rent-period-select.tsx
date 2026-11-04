import { useT } from "@/lib/i18n/use-t"
import { FormField } from "./form-field"
import { SelectInput } from "./select-input"

const periods = ["day", "week", "month"] as const

// "Price per day / week / month" for a listing that is for rent.
export function RentPeriodSelect({
  value,
  onChange,
  error,
}: {
  value: string | null
  onChange: (value: string | null) => void
  error?: string
}) {
  const { t } = useT()
  return (
    <FormField label={t("form.rent_period")} error={error}>
      {(control) => (
        <SelectInput
          {...control}
          value={value ?? ""}
          placeholder={t("form.select_period")}
          options={periods.map((p) => ({
            value: p,
            label: t(`listing.per_${p}`),
          }))}
          onChange={(v) => onChange(v || null)}
        />
      )}
    </FormField>
  )
}
