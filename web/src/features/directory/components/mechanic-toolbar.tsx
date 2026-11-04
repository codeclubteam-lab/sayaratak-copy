import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { CitySelect } from "@/components/app/city-select"
import { FilterSwitch } from "@/components/app/filter-switch"
import { FormField } from "@/components/app/form-field"
import { SelectInput } from "@/components/app/select-input"
import { SortSelect } from "@/components/app/sort-select"
import {
  mechanicSorts,
  minYearsOptions,
  type MechanicSearch,
} from "../mechanic-schemas"
import { DirectoryToolbar } from "./directory-toolbar"

// Every control writes the whole next filter set to the URL (page back to 1).
export function MechanicToolbar({
  search,
  onChange,
  resultCount,
}: {
  search: MechanicSearch
  onChange: (next: MechanicSearch) => void
  resultCount: number | undefined
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  return (
    <DirectoryToolbar
      q={search.q}
      nameLabel={t("directory.mechanic_search_name")}
      onSearch={(q) => onChange({ ...search, q, page: 1 })}
      activeCount={
        [
          search.city,
          search.specialization,
          search.minYears,
          search.verified,
          search.available,
        ].filter(Boolean).length
      }
      resultCount={resultCount}
      fields={
        <>
          <div className="w-full md:w-48">
            <CitySelect
              value={search.city ?? ""}
              onChange={(city) =>
                onChange({ ...search, city: city || undefined, page: 1 })
              }
            />
          </div>
          <div className="w-full md:w-52">
            <FormField label={t("directory.specialization")}>
              {(c) => (
                <SelectInput
                  {...c}
                  value={search.specialization ?? ""}
                  placeholder={t("directory.any_specialization")}
                  onChange={(specialization) =>
                    onChange({
                      ...search,
                      specialization: specialization || undefined,
                      page: 1,
                    })
                  }
                  options={(tax?.specializations ?? []).map((s) => ({
                    value: s.id,
                    label: s.name[locale],
                  }))}
                />
              )}
            </FormField>
          </div>
          <div className="w-full md:w-44">
            <FormField label={t("directory.experience")}>
              {(c) => (
                <SelectInput
                  {...c}
                  value={search.minYears?.toString() ?? ""}
                  placeholder={t("directory.any_experience")}
                  onChange={(years) =>
                    onChange({
                      ...search,
                      minYears: years ? Number(years) : undefined,
                      page: 1,
                    })
                  }
                  options={minYearsOptions.map((years) => ({
                    value: String(years),
                    label: t("directory.min_years_option", { years }),
                  }))}
                />
              )}
            </FormField>
          </div>
        </>
      }
      switches={
        <>
          <FilterSwitch
            label={t("directory.verified_only")}
            checked={search.verified ?? false}
            onChange={(on) =>
              onChange({ ...search, verified: on || undefined, page: 1 })
            }
          />
          <FilterSwitch
            label={t("directory.available")}
            checked={search.available ?? false}
            onChange={(on) =>
              onChange({ ...search, available: on || undefined, page: 1 })
            }
          />
        </>
      }
      sort={
        <SortSelect
          value={search.sort}
          options={mechanicSorts}
          onChange={(sort) => onChange({ ...search, sort, page: 1 })}
        />
      }
    />
  )
}
