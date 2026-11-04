import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { LocateFixedIcon } from "lucide-react"

import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { defaultCenter } from "@/lib/map"
import type { Geo } from "@sayaratak/shared/schemas/fields"
import { Button } from "@/components/ui/button"
import { RemoveButton } from "@/components/app/remove-button"
import { CityDistrictFields } from "./city-district-fields"
import { FieldError } from "./field-error"
import { MapCanvas } from "./map-canvas"

export type LocationValue = {
  cityId: string
  districtId: string | null
  location: Geo | null
}

type Status = "idle" | "locating" | "denied" | "failed"

// City and district, the device position and a pin on the map; the three stay in step through one value.
export function LocationPicker({
  value,
  onChange,
  cityError,
  districtError,
  districtRequired,
}: {
  value: LocationValue
  onChange: (value: LocationValue) => void
  cityError?: string
  districtError?: string
  districtRequired?: boolean
}) {
  const { t } = useT()
  const { data } = useQuery(taxonomyQuery)
  const [status, setStatus] = useState<Status>("idle")
  const city = data?.cities.find((c) => c.id === value.cityId)
  // The map follows the city and the device position, not a pin the person drops or drags, so the pin never jumps under the cursor.
  const [focus, setFocus] = useState<Geo | null>(null)
  const center = focus ?? city?.center ?? defaultCenter

  const locate = () => {
    if (!("geolocation" in navigator)) return setStatus("failed")
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        setStatus("idle")
        setFocus(here)
        onChange({ ...value, location: here })
      },
      (err) =>
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "failed"),
      { enableHighAccuracy: true, timeout: 15_000 }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CityDistrictFields
        value={value}
        cityError={cityError}
        districtError={districtError}
        districtRequired={districtRequired}
        // A pin in another city would contradict the new one, so it is cleared.
        onChange={(next) => {
          setFocus(null)
          onChange({ ...next, location: null })
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={status === "locating"}
          onClick={locate}
        >
          <LocateFixedIcon data-icon="inline-start" />
          {t("form.use_location")}
        </Button>
        {value.location && (
          <RemoveButton
            variant="ghost"
            title={t("form.remove_pin_title")}
            onConfirm={() => onChange({ ...value, location: null })}
          >
            {t("form.remove_pin")}
          </RemoveButton>
        )}
        <span role="status" className="text-caption text-muted-foreground">
          {status === "locating" && t("form.locating")}
        </span>
      </div>
      <FieldError
        message={
          status === "denied"
            ? "form.location_denied"
            : status === "failed"
              ? "form.location_failed"
              : undefined
        }
      />
      <MapCanvas
        label={t("form.map_label")}
        center={center}
        zoom={focus ? 15 : city ? 11 : 6}
        pin={value.location}
        onPick={(location) => onChange({ ...value, location })}
      />
      <p className="text-caption text-muted-foreground">{t("form.pin_hint")}</p>
    </div>
  )
}
