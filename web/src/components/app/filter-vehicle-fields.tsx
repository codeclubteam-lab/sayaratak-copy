import { Controller, useFormContext } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import {
  activeCount,
  type FilterDraft,
  type FilterGroup,
} from "@/features/search/filters"
import { useFacetLabel } from "@/features/search/use-facet-label"
import { useT } from "@/lib/i18n/use-t"
import type { ListingPage } from "@sayaratak/shared/schemas/listing"
import { ChipMultiSelect } from "./chip-multi-select"
import { FilterSection } from "./filter-section"
import { FormField } from "./form-field"
import { MakeLogo } from "./make-logo"
import { NumberField } from "./number-field"
import { SelectInput } from "./select-input"

// Make and model, year, mileage, fuel and transmission. Vehicles only; part searches skip this group.
export function FilterVehicleFields({
  facets,
  show,
}: {
  facets?: ListingPage["facets"]
  show: (group: FilterGroup) => boolean
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const { control, watch, setValue } = useFormContext<FilterDraft>()
  const draft = watch()
  const withCount = useFacetLabel(facets)
  const makes = (tax?.makes ?? []).filter(
    (m) => !draft.type || m.vehicleTypes.includes(draft.type)
  )
  const models = (tax?.models ?? []).filter((m) => m.makeId === draft.make)
  const optionsOf = (kind: "fuel" | "transmission", values: string[]) =>
    values.map((v) => ({
      value: v,
      label: withCount(t(`${kind}.${v}`), facets?.[kind], v),
    }))
  return (
    <>
      {show("make") && (
        <FilterSection
          title={t("search.group_make")}
          defaultOpen
          active={activeCount(draft.make, draft.model)}
        >
          <FormField label={t("form.make")}>
            {(c) => (
              <SelectInput
                {...c}
                value={draft.make}
                placeholder={t("form.select_make")}
                options={makes.map((m) => ({
                  value: m.id,
                  label: withCount(m.name[locale], facets?.make, m.id),
                  icon: <MakeLogo id={m.id} name={m.name.en} />,
                }))}
                onChange={(v) => {
                  setValue("make", v)
                  setValue("model", "")
                }}
              />
            )}
          </FormField>
          {draft.make && (
            <FormField label={t("form.model")}>
              {(c) => (
                <SelectInput
                  {...c}
                  value={draft.model}
                  placeholder={t("form.select_model")}
                  options={models.map((m) => ({
                    value: m.id,
                    label: m.name[locale],
                  }))}
                  onChange={(v) => setValue("model", v)}
                />
              )}
            </FormField>
          )}
        </FilterSection>
      )}
      {(show("year") || show("mileage")) && (
        <FilterSection
          title={t(
            show("mileage") ? "search.group_year" : "search.group_year_only"
          )}
          active={activeCount(
            draft.minYear,
            draft.maxYear,
            show("mileage") ? draft.maxMileage : null
          )}
        >
          {show("year") && (
            <div className="grid grid-cols-2 gap-3">
              {(["minYear", "maxYear"] as const).map((name) => (
                <Controller
                  key={name}
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <FormField
                      label={t(
                        `search.${name === "minYear" ? "min_year" : "max_year"}`
                      )}
                    >
                      {(c) => (
                        <NumberField
                          {...c}
                          min={1970}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    </FormField>
                  )}
                />
              ))}
            </div>
          )}
          {show("mileage") && (
            <Controller
              control={control}
              name="maxMileage"
              render={({ field }) => (
                <FormField label={t("search.max_mileage")}>
                  {(c) => (
                    <NumberField
                      {...c}
                      grouping
                      min={0}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>
              )}
            />
          )}
        </FilterSection>
      )}
      {show("fuel") && (
        <FilterSection
          title={t("search.group_fuel")}
          active={activeCount(draft.fuel, draft.transmission)}
        >
          <Controller
            control={control}
            name="fuel"
            render={({ field }) => (
              <ChipMultiSelect
                legend={t("search.fuel")}
                options={optionsOf("fuel", [
                  "petrol",
                  "diesel",
                  "hybrid",
                  "electric",
                  "lpg",
                ])}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="transmission"
            render={({ field }) => (
              <ChipMultiSelect
                legend={t("search.transmission")}
                options={optionsOf("transmission", ["automatic", "manual"])}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </FilterSection>
      )}
    </>
  )
}
