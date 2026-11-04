import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext } from "react-hook-form"

import { ChipMultiSelect } from "@/components/app/chip-multi-select"
import { CitySelect } from "@/components/app/city-select"
import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import type { MechanicExpertise } from "../schemas"

export function MechanicExpertiseStep() {
  const { t, locale } = useT()
  const { control, watch, setValue } = useFormContext<MechanicExpertise>()
  const taxonomy = useQuery(taxonomyQuery).data
  const home = watch("cityId")
  const label = (x: { id: string; name: Record<"en" | "ar", string> }) => ({
    value: x.id,
    label: x.name[locale],
  })
  return (
    <>
      <Controller
        control={control}
        name="specializationIds"
        render={({ field, fieldState }) => (
          <ChipMultiSelect
            legend={t("onboarding.mechanic_specializations_legend")}
            options={taxonomy?.specializations.map(label) ?? []}
            value={field.value}
            onChange={field.onChange}
            max={6}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="cityId"
        render={({ field, fieldState }) => (
          <CitySelect
            label={t("onboarding.mechanic_home_city_label")}
            value={field.value}
            onChange={(id) => {
              field.onChange(id)
              setValue(
                "servedCityIds",
                watch("servedCityIds").filter((c) => c !== id)
              )
            }}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="servedCityIds"
        render={({ field, fieldState }) => (
          <ChipMultiSelect
            legend={`${t("onboarding.mechanic_served_cities_legend")} (${t("form.optional")})`}
            options={(taxonomy?.cities.filter((c) => c.id !== home) ?? []).map(
              label
            )}
            value={field.value}
            onChange={field.onChange}
            max={5}
            error={fieldState.error?.message}
          />
        )}
      />
    </>
  )
}
