import { useT } from "@/lib/i18n/use-t"
import { CitySelect } from "@/components/app/city-select"
import { FilterSwitch } from "@/components/app/filter-switch"
import { SortSelect } from "@/components/app/sort-select"
import { dealershipSorts, type DealershipSearch } from "../schemas"
import { DirectoryToolbar } from "./directory-toolbar"

// Every control writes the whole next filter set to the URL (page back to 1).
export function DealershipToolbar({
  search,
  onChange,
  resultCount,
}: {
  search: DealershipSearch
  onChange: (next: DealershipSearch) => void
  resultCount: number | undefined
}) {
  const { t } = useT()
  return (
    <DirectoryToolbar
      q={search.q}
      nameLabel={t("directory.search_name")}
      onSearch={(q) => onChange({ ...search, q, page: 1 })}
      activeCount={
        Number(Boolean(search.city)) + Number(Boolean(search.verified))
      }
      resultCount={resultCount}
      fields={
        <div className="w-full md:w-56">
          <CitySelect
            value={search.city ?? ""}
            onChange={(city) =>
              onChange({ ...search, city: city || undefined, page: 1 })
            }
          />
        </div>
      }
      switches={
        <FilterSwitch
          label={t("directory.verified_only")}
          checked={search.verified ?? false}
          onChange={(on) =>
            onChange({ ...search, verified: on || undefined, page: 1 })
          }
        />
      }
      sort={
        <SortSelect
          value={search.sort}
          options={dealershipSorts}
          onChange={(sort) => onChange({ ...search, sort, page: 1 })}
        />
      }
    />
  )
}
