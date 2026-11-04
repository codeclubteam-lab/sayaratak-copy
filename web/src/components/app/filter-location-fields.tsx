import { useState } from "react"
import { useFormContext } from "react-hook-form"

import { activeCount, radii, type FilterDraft } from "@/features/search/filters"
import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"
import { CityDistrictFields } from "./city-district-fields"
import { FilterSection } from "./filter-section"
import { FormField } from "./form-field"
import { SelectInput } from "./select-input"

// City, district and distance. A radius counts from the city center or from a position. With neither, the browser is asked once; if that fails the control stays off until a city is chosen or the position is shared.
export function FilterLocationFields() {
  const { t } = useT()
  const { watch, setValue } = useFormContext<FilterDraft>()
  const draft = watch()
  const [place, setPlace] = useState<"idle" | "asking" | "failed">("idle")
  const located = Boolean(draft.city) || draft.origin !== null
  const locate = () => {
    setPlace("asking")
    const failed = () => {
      setPlace("failed")
      setValue("radius", null)
    }
    if (!("geolocation" in navigator)) return failed()
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace("idle")
        setValue("origin", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      failed,
      { timeout: 10_000 }
    )
  }
  return (
    <FilterSection
      title={t("search.group_location")}
      active={activeCount(draft.city, draft.district, draft.radius)}
    >
      <CityDistrictFields
        className="gap-3 sm:grid-cols-1"
        value={{ cityId: draft.city, districtId: draft.district }}
        onChange={(v) => {
          setValue("city", v.cityId)
          setValue("district", v.districtId)
        }}
      />
      <FormField label={t("search.radius")}>
        {(c) => (
          <SelectInput
            {...c}
            disabled={place === "asking" || (!located && place === "failed")}
            value={draft.radius ? String(draft.radius) : ""}
            placeholder={t("search.radius_any")}
            options={radii.map((r) => ({
              value: String(r),
              label: t("search.radius_value", { km: r }),
            }))}
            onChange={(v) => {
              setValue("radius", v ? Number(v) : null)
              if (v && !located) locate()
            }}
          />
        )}
      </FormField>
      {!located && place === "failed" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-caption text-muted-foreground">
            {t("search.radius_needs_place")}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={locate}>
            {t("search.use_location")}
          </Button>
        </div>
      )}
    </FilterSection>
  )
}
