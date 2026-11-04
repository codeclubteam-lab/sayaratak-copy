import { useQuery } from "@tanstack/react-query"

import { ChipMultiSelect } from "@/components/app/chip-multi-select"
import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import {
  featureGroups,
  featureGroupsFor,
} from "@sayaratak/shared/schemas/listing-fields"
import { useStepFields } from "./use-step-fields"

// The equipment of a vehicle: one chip group per kind of feature, all stored in the one `features` list.
export function FeaturesField() {
  const { t } = useT()
  const { values, set } = useStepFields()
  const chosen: string[] = values.features ?? []
  return (
    <div className="flex flex-col gap-4">
      {featureGroupsFor(values.vehicleType).map((group) => (
        <ChipMultiSelect
          key={group}
          legend={t(`spec.group_${group}`)}
          options={featureGroups[group].map((id) => ({
            value: id,
            label: t(`feature.${id}`),
          }))}
          value={chosen}
          onChange={(next) => set("features", next)}
        />
      ))}
    </div>
  )
}

// The makes a part also fits, besides the one it comes from. Only makes that exist in a chosen vehicle type are offered.
export function FitsMakesField() {
  const { t, locale } = useT()
  const { data } = useQuery(taxonomyQuery)
  const { values, set } = useStepFields()
  const types: string[] = values.compatibleTypes ?? []
  const makes =
    data?.makes.filter((m) => m.vehicleTypes.some((v) => types.includes(v))) ??
    []
  if (makes.length === 0) return null
  return (
    <ChipMultiSelect
      legend={t("form.compatible_make_ids")}
      options={makes.map((m) => ({ value: m.id, label: m.name[locale] }))}
      value={values.compatibleMakeIds ?? []}
      onChange={(next) => set("compatibleMakeIds", next)}
    />
  )
}
