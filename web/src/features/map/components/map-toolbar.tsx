import { useQuery } from "@tanstack/react-query"
import { LocateFixedIcon } from "lucide-react"

import { taxonomyQuery } from "@/features/listings/queries"
import type { FilterGroup } from "@/features/search/filters"
import { IntentToggle } from "@/features/search/components/intent-toggle"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { useT } from "@/lib/i18n/use-t"
import { FilterSheet } from "@/components/app/filter-sheet"
import { SelectInput } from "@/components/app/select-input"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MAP_LAYERS, type MapLayer, type MapSearch } from "../schemas"

// The sheet edits the vehicle filters the map takes, minus city and intent, which sit in this bar.
const groups = [
  "category",
  "price",
  "make",
  "year",
] as const satisfies readonly FilterGroup[]

export type Place = "idle" | "locating" | "denied" | "failed"

export function MapToolbar({
  search,
  layers,
  place,
  onChange,
  onCity,
  onLocate,
}: {
  search: MapSearch
  layers: readonly MapLayer[]
  place: Place
  onChange: (next: MapSearch) => void
  onCity: (cityId: string) => void
  onLocate: () => void
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const note = {
    locating: "form.locating",
    denied: "form.location_denied",
    failed: "form.location_failed",
  }[place as Exclude<Place, "idle">]
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          multiple
          aria-label={t("map.layers")}
          variant="outline"
          className="flex-wrap"
          value={[...layers]}
          // At least one layer stays on.
          onValueChange={(next) => {
            const on = MAP_LAYERS.filter((l) => next.includes(l))
            if (on.length) onChange({ ...search, layers: on })
          }}
        >
          {MAP_LAYERS.map((l) => (
            <ToggleGroupItem key={l} value={l}>
              {t(`map.layer_${l}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <IntentToggle
          value={search.intent}
          onChange={(intent) => onChange({ ...search, intent })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          aria-label={t("form.city")}
          className="w-40 sm:w-48"
          value={search.city ?? ""}
          placeholder={t("form.select_city")}
          options={(tax?.cities ?? []).map((c) => ({
            value: c.id,
            label: c.name[locale],
          }))}
          onChange={onCity}
        />
        <FilterSheet
          triggerClassName=""
          groups={groups}
          // Lat and lng here mean the viewport, not a radius origin, and the city has its own select, so neither counts as a sheet filter.
          params={searchParamsSchema.parse({
            ...search,
            city: undefined,
            lat: undefined,
            lng: undefined,
          })}
          onApply={(next) =>
            onChange({
              ...search,
              type: next.type,
              make: next.make,
              model: next.model,
              minPrice: next.minPrice,
              maxPrice: next.maxPrice,
              minYear: next.minYear,
              maxYear: next.maxYear,
            })
          }
        />
        <Button
          type="button"
          variant="outline"
          disabled={place === "locating"}
          onClick={onLocate}
        >
          <LocateFixedIcon data-icon="inline-start" />
          <span className="sr-only sm:not-sr-only">
            {t("search.use_location")}
          </span>
        </Button>
      </div>
      {note && (
        <p role="status" className="text-caption text-muted-foreground">
          {t(note)}
        </p>
      )}
    </div>
  )
}
