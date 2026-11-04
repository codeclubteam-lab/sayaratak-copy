import { SortSelect } from "@/components/app/sort-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useT } from "@/lib/i18n/use-t"
import { favoriteSortSchema } from "@sayaratak/shared/schemas/inputs"
import {
  typeFilterSchema,
  vehicleTypeSchema,
} from "@sayaratak/shared/schemas/listing"
import type { FavoritesSearch } from "../schemas"

const types = ["all", ...vehicleTypeSchema.options, "part"] as const

// Type filter and sort. A change starts again at page 1. The type group is a radio: pressing the chosen type again keeps it.
export function FavoritesToolbar({
  search,
  onChange,
}: {
  search: FavoritesSearch
  onChange: (next: Partial<FavoritesSearch>) => void
}) {
  const { t } = useT()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="max-w-full overflow-x-auto">
        <ToggleGroup
          aria-label={t("dashboard.favorites_filter_label")}
          variant="outline"
          spacing={0}
          value={[search.type ?? "all"]}
          onValueChange={(next) => {
            if (next[0])
              onChange({
                type: typeFilterSchema.safeParse(next[0]).data,
                page: 1,
              })
          }}
        >
          {types.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {t(`dashboard.favorites_${value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <SortSelect
        value={search.sort}
        options={favoriteSortSchema.options}
        onChange={(sort) => onChange({ sort, page: 1 })}
      />
    </div>
  )
}
