import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import { CitySelect } from "./city-select"
import { FormField } from "./form-field"
import { SelectInput } from "./select-input"

export type CityDistrictValue = { cityId: string; districtId: string | null }

// Changing the city clears the district, since districts belong to one city.
export function CityDistrictFields({
  value,
  onChange,
  cityError,
  districtError,
  districtRequired = false,
  className,
}: {
  value: CityDistrictValue
  onChange: (value: CityDistrictValue) => void
  cityError?: string
  districtError?: string
  districtRequired?: boolean
  className?: string
}) {
  const { t, locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  const districts =
    data?.districts.filter((d) => d.cityId === value.cityId) ?? []
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <CitySelect
        value={value.cityId}
        error={cityError}
        onChange={(cityId) => onChange({ cityId, districtId: null })}
      />
      <FormField
        label={t("form.district")}
        error={districtError}
        optional={!districtRequired}
      >
        {(control) => (
          <SelectInput
            {...control}
            disabled={districts.length === 0}
            value={value.districtId ?? ""}
            onChange={(id) => onChange({ ...value, districtId: id || null })}
            placeholder={t("form.select_district")}
            options={districts.map((d) => ({
              value: d.id,
              label: d.name[locale],
            }))}
          />
        )}
      </FormField>
    </div>
  )
}
