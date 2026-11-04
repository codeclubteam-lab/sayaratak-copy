import { useEffect, useRef } from "react"
import { Controller, FormProvider } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"

import { listingQueries, taxonomyQuery } from "@/features/listings/queries"
import {
  activeCount,
  applyDraft,
  clearFilters,
  toDraft,
  type FilterGroup,
} from "@/features/search/filters"
import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { useDebounced } from "@/hooks/use-debounced"
import { useFacetLabel } from "@/features/search/use-facet-label"
import { useT } from "@/lib/i18n/use-t"
import type { ListingPage } from "@sayaratak/shared/schemas/listing"
import { Button } from "@/components/ui/button"
import { ChipSingleSelect } from "./chip-single-select"
import { CheckboxGroup } from "./checkbox-group"
import { FilterLocationFields } from "./filter-location-fields"
import { FilterSection } from "./filter-section"
import { FilterSpecFields } from "./filter-spec-fields"
import { FilterVehicleFields } from "./filter-vehicle-fields"
import { FieldMarks, FormField } from "./form-field"
import { NumberField } from "./number-field"
import { useAppForm } from "@/hooks/use-app-form"

type Facets = ListingPage["facets"]

// The desktop panel is denser than the 36 px forms: 32 px fields and chips, tighter gaps. The sheet on a phone keeps the 44 px touch size.
const dense =
  "flex flex-col gap-1 [--control-h:2rem] [--row-h:1.75rem] [&_[data-slot=chip-group]]:gap-1.5 [&_[data-slot=chip]]:px-3 [&_[data-slot=field-label]]:text-caption [&_[data-slot=field-label]]:font-normal [&_[data-slot=field]]:gap-1"

// One form for the desktop panel and the mobile sheet. It edits a local draft. The panel writes it to the URL 300 ms after the last change; the sheet waits for "Show N results".
export function FilterForm({
  params,
  facets,
  variant,
  groups,
  onApply,
}: {
  params: SearchParams
  facets?: Facets
  variant: "panel" | "sheet"
  groups?: readonly FilterGroup[]
  onApply: (next: SearchParams) => void
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const methods = useAppForm({ defaultValues: toDraft(params) })
  const { control, handleSubmit, watch, setValue, reset } = methods
  const draft = watch()
  const centerOf = (city: string) =>
    tax?.cities.find((c) => c.id === city)?.center
  const next = () => applyDraft(params, draft, centerOf(draft.city))
  // The last draft that is, or is about to be, in the URL. A URL that arrives with anything else (a chip, "Clear all", the back button) replaces the draft; one this form wrote leaves it alone, so typing is never interrupted.
  const synced = useRef(JSON.stringify(toDraft(params)))
  useEffect(() => {
    const incoming = JSON.stringify(toDraft(params))
    if (incoming === synced.current) return
    synced.current = incoming
    reset(toDraft(params))
  }, [params, reset])
  const settled = useDebounced(JSON.stringify(draft))
  useEffect(() => {
    if (variant !== "panel" || settled === synced.current) return
    synced.current = settled
    onApply(next())
    // `next` and `onApply` change every render; only a settled draft should fire this.
  }, [settled, variant])
  // Live count for the sheet button; the panel shows facet counts instead.
  const preview = useDebounced(next())
  const { data: count } = useQuery({
    ...listingQueries.list(preview),
    enabled: variant === "sheet",
    select: (page) => page.total,
  })

  const withCount = useFacetLabel(facets)
  const isPart = params.kind === "part"
  const vehicleTypes = (tax?.vehicleTypes ?? [])
    .filter((v) => v.enabled)
    .map((v) => ({
      value: v.id,
      label: withCount(v.name[locale], facets?.type, v.id),
    }))
  const partCategories = (tax?.partCategories ?? [])
    .map((c) => ({ value: c.id, label: c.name[locale] }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  const any = { value: "", label: t("search.any") }
  const show = (g: FilterGroup) => !groups || groups.includes(g)

  return (
    <FormProvider {...methods}>
      <FieldMarks value="none">
        <form
          onSubmit={handleSubmit((d) =>
            onApply(applyDraft(params, d, centerOf(d.city)))
          )}
          className={variant === "panel" ? dense : "flex flex-col gap-2"}
        >
          {show("category") && (
            <FilterSection
              title={t("search.group_category")}
              defaultOpen
              active={activeCount(draft.type, draft.partCategory)}
            >
              {isPart && (
                <Controller
                  control={control}
                  name="partCategory"
                  render={({ field }) => (
                    <ChipSingleSelect
                      legend={t("search.part_category")}
                      options={[any, ...partCategories]}
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(v || null)}
                    />
                  )}
                />
              )}
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <ChipSingleSelect
                    legend={t(
                      isPart ? "search.fits_type" : "search.vehicle_type"
                    )}
                    hideLegend={!isPart}
                    options={[any, ...vehicleTypes]}
                    value={field.value ?? ""}
                    onChange={(v) => {
                      field.onChange(v || null)
                      if (!isPart) {
                        setValue("make", "")
                        setValue("model", "")
                      }
                    }}
                  />
                )}
              />
            </FilterSection>
          )}
          {show("price") && (
            <FilterSection
              title={t("search.group_price")}
              defaultOpen
              active={activeCount(draft.minPrice, draft.maxPrice)}
            >
              <div className="grid grid-cols-2 gap-3">
                {(["minPrice", "maxPrice"] as const).map((name) => (
                  <Controller
                    key={name}
                    control={control}
                    name={name}
                    render={({ field }) => (
                      <FormField
                        label={t(
                          `search.${name === "minPrice" ? "min_price" : "max_price"}`
                        )}
                      >
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
                ))}
              </div>
            </FilterSection>
          )}
          {!isPart && <FilterVehicleFields facets={facets} show={show} />}
          {show("condition") && (
            <FilterSection
              title={t("search.group_condition")}
              defaultOpen={isPart}
              active={activeCount(draft.condition)}
            >
              <Controller
                control={control}
                name="condition"
                render={({ field }) => (
                  <ChipSingleSelect
                    legend={t("search.condition")}
                    hideLegend
                    options={[
                      any,
                      { value: "new", label: t("condition.new") },
                      { value: "used", label: t("condition.used") },
                    ]}
                    value={field.value ?? ""}
                    onChange={(v) =>
                      field.onChange(v === "new" || v === "used" ? v : null)
                    }
                  />
                )}
              />
            </FilterSection>
          )}
          {show("location") && <FilterLocationFields />}
          {show("spec") && (
            <FilterSpecFields part={isPart} intent={params.intent} />
          )}
          {show("more") && (
            <FilterSection
              title={t("search.group_more")}
              active={activeCount(
                draft.verifiedOnly,
                draft.hasVideo,
                draft.includeSold
              )}
            >
              <CheckboxGroup
                hideLegend
                legend={t("search.group_more")}
                options={[
                  { value: "verifiedOnly", label: t("search.verified_only") },
                  { value: "hasVideo", label: t("search.has_video") },
                  { value: "includeSold", label: t("search.include_sold") },
                ]}
                value={(
                  ["verifiedOnly", "hasVideo", "includeSold"] as const
                ).filter((k) => draft[k])}
                onChange={(on) => {
                  for (const k of [
                    "verifiedOnly",
                    "hasVideo",
                    "includeSold",
                  ] as const)
                    setValue(k, on.includes(k))
                }}
              />
            </FilterSection>
          )}
          <div className="sticky bottom-0 flex gap-3 bg-background py-3">
            {variant === "sheet" && (
              <Button type="submit" className="flex-1">
                {count !== undefined
                  ? t("search.show_results", { count })
                  : t("search.apply")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className={variant === "panel" ? "flex-1" : undefined}
              onClick={() => onApply(clearFilters(params))}
            >
              {t("common.clear_all")}
            </Button>
          </div>
        </form>
      </FieldMarks>
    </FormProvider>
  )
}
