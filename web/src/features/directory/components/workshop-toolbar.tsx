import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LocateFixedIcon, LocateOffIcon } from "lucide-react"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { CitySelect } from "@/components/app/city-select"
import { FilterSwitch } from "@/components/app/filter-switch"
import { FormField } from "@/components/app/form-field"
import { SelectInput } from "@/components/app/select-input"
import { SortSelect } from "@/components/app/sort-select"
import { Button } from "@/components/ui/button"
import { workshopSorts, type WorkshopSearch } from "../workshop-schemas"
import { DirectoryToolbar } from "./directory-toolbar"

const round = (n: number) => Math.round(n * 1e4) / 1e4

// Every control writes the whole next filter set to the URL (page back to 1). "Use my location" asks the browser once, stores the position in the address and switches the sort to nearest; clearing it drops both.
export function WorkshopToolbar({
  search,
  onChange,
  resultCount,
}: {
  search: WorkshopSearch
  onChange: (next: WorkshopSearch) => void
  resultCount: number | undefined
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const [place, setPlace] = useState<"idle" | "asking" | "denied" | "failed">(
    "idle"
  )
  const located = search.lat !== undefined
  const locate = () => {
    if (!("geolocation" in navigator)) return setPlace("failed")
    setPlace("asking")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace("idle")
        onChange({
          ...search,
          lat: round(pos.coords.latitude),
          lng: round(pos.coords.longitude),
          sort: "nearest",
          page: 1,
        })
      },
      (err) =>
        setPlace(err.code === err.PERMISSION_DENIED ? "denied" : "failed"),
      { timeout: 10_000 }
    )
  }
  const clear = () =>
    onChange({
      ...search,
      lat: undefined,
      lng: undefined,
      sort: search.sort === "nearest" ? "rating" : search.sort,
      page: 1,
    })
  return (
    <DirectoryToolbar
      q={search.q}
      nameLabel={t("directory.workshop_search_name")}
      onSearch={(q) => onChange({ ...search, q, page: 1 })}
      activeCount={
        [
          search.city,
          search.service,
          search.verified,
          search.openNow,
          located,
        ].filter(Boolean).length
      }
      resultCount={resultCount}
      fields={
        <>
          <div className="w-full md:w-56">
            <CitySelect
              value={search.city ?? ""}
              onChange={(city) =>
                onChange({ ...search, city: city || undefined, page: 1 })
              }
            />
          </div>
          <div className="w-full md:w-56">
            <FormField label={t("directory.service")}>
              {(c) => (
                <SelectInput
                  {...c}
                  value={search.service ?? ""}
                  placeholder={t("directory.any_service")}
                  onChange={(service) =>
                    onChange({
                      ...search,
                      service: service || undefined,
                      page: 1,
                    })
                  }
                  options={(tax?.serviceTemplates ?? []).map((s) => ({
                    value: s.id,
                    label: s.name[locale],
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
            label={t("directory.open_now_only")}
            checked={search.openNow ?? false}
            onChange={(on) =>
              onChange({ ...search, openNow: on || undefined, page: 1 })
            }
          />
          <Button
            type="button"
            variant="outline"
            disabled={place === "asking"}
            onClick={located ? clear : locate}
          >
            {located ? (
              <LocateOffIcon data-icon="inline-start" />
            ) : (
              <LocateFixedIcon data-icon="inline-start" />
            )}
            {t(
              located
                ? "directory.clear_location"
                : place === "asking"
                  ? "form.locating"
                  : "search.use_location"
            )}
          </Button>
          <p
            role="status"
            className="text-caption text-muted-foreground empty:hidden"
          >
            {place === "denied"
              ? t("form.location_denied")
              : place === "failed"
                ? t("form.location_failed")
                : null}
          </p>
        </>
      }
      sort={
        <SortSelect
          value={search.sort}
          options={
            located
              ? workshopSorts
              : workshopSorts.filter((s) => s !== "nearest")
          }
          onChange={(sort) => onChange({ ...search, sort, page: 1 })}
        />
      }
    />
  )
}
