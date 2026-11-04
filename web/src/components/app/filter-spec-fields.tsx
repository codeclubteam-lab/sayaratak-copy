import { Controller, useFormContext } from "react-hook-form"

import type { FilterDraft } from "@/features/search/filters"
import {
  flagKeys,
  flagLabel,
  listPrefix,
  type FlagKey,
  type ListKey,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"
import { useT } from "@/lib/i18n/use-t"
import {
  bodyTypes,
  featureGroups,
  featureGroupsFor,
  specOptions,
} from "@sayaratak/shared/schemas/listing-fields"
import { CheckboxGroup } from "./checkbox-group"
import { ChipMultiSelect } from "./chip-multi-select"
import { FilterSection } from "./filter-section"
import { FormField } from "./form-field"
import { NumberField } from "./number-field"

// Choices of each list filter.
const choices = (key: ListKey, type: FilterDraft["type"]): readonly string[] =>
  key === "body"
    ? type
      ? bodyTypes[type]
      : [...new Set(Object.values(bodyTypes).flat())]
    : key === "drive"
      ? specOptions.driveType
      : key === "madeIn"
        ? specOptions.origin
        : key === "driver"
          ? specOptions.driver
          : specOptions.partType

const legendOf: Record<ListKey, string> = {
  body: "form.body_type",
  drive: "form.drive_type",
  madeIn: "form.origin",
  driver: "form.driver",
  partType: "form.part_type",
}

// "More filters": the step 7.9 fields. Which ones show follows the kind and the intent of the search; the block is closed until one of them is set.
export function FilterSpecFields({
  part,
  intent,
}: {
  part: boolean
  intent: SearchParams["intent"]
}) {
  const { t } = useT()
  const { control, watch } = useFormContext<FilterDraft>()
  const draft = watch()
  const lists: ListKey[] = part
    ? ["partType", "madeIn"]
    : [
        "body",
        "drive",
        "madeIn",
        ...(intent === "sale" ? [] : (["driver"] as const)),
      ]
  const shown: FlagKey[] = flagKeys.filter((k) =>
    part
      ? ["warranty", "delivery", "installation"].includes(k)
      : !["installation"].includes(k) &&
        (intent !== "rent" || !["exchange", "financing"].includes(k)) &&
        (intent !== "sale" || !["insuranceIncluded", "delivery"].includes(k))
  )
  const active =
    draft.flags.length +
    lists.reduce((n, k) => n + draft[k].length, 0) +
    (part ? 0 : draft.features.length + (draft.seatsMin === null ? 0 : 1)) +
    (part && draft.fitsYear !== null ? 1 : 0)
  return (
    <FilterSection title={t("search.group_spec")} active={active}>
      <div className="flex flex-col gap-3">
        {lists.map((key) => (
          <Controller
            key={key}
            control={control}
            name={key}
            render={({ field }) => (
              <ChipMultiSelect
                legend={t(legendOf[key])}
                options={choices(key, draft.type).map((v) => ({
                  value: v,
                  label: t(
                    `spec.${listPrefix[key]}_${v === "other" ? "misc" : v}`
                  ),
                }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        ))}
        {!part && (
          <Controller
            control={control}
            name="seatsMin"
            render={({ field }) => (
              <FormField label={t("search.min_seats")}>
                {(c) => (
                  <NumberField
                    {...c}
                    min={1}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              </FormField>
            )}
          />
        )}
        {part && (
          <Controller
            control={control}
            name="fitsYear"
            render={({ field }) => (
              <FormField label={t("search.fits_year")}>
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
        )}
        <Controller
          control={control}
          name="flags"
          render={({ field }) => (
            <CheckboxGroup
              legend={t("search.group_spec_flags")}
              options={shown.map((k) => ({
                value: k,
                label: t(flagLabel[k]),
              }))}
              value={field.value}
              onChange={(on) =>
                // Flags of another kind of search stay as they are.
                field.onChange(
                  flagKeys.filter((k) =>
                    shown.includes(k) ? on.includes(k) : field.value.includes(k)
                  )
                )
              }
            />
          )}
        />
        {!part && (
          <Controller
            control={control}
            name="features"
            render={({ field }) => (
              <div className="flex flex-col gap-4">
                {featureGroupsFor(draft.type ?? "car").map((group) => (
                  <ChipMultiSelect
                    key={group}
                    legend={t(`spec.group_${group}`)}
                    options={featureGroups[group].map((id) => ({
                      value: id,
                      label: t(`feature.${id}`),
                    }))}
                    value={field.value}
                    onChange={field.onChange}
                  />
                ))}
              </div>
            )}
          />
        )}
      </div>
    </FilterSection>
  )
}
