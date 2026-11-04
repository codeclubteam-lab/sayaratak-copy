import { useMemo, useState } from "react"
import { MapPinIcon } from "lucide-react"

import { useCityName } from "@/hooks/use-city-name"
import { useT } from "@/lib/i18n/use-t"
import type { Geo } from "@sayaratak/shared/schemas/fields"
import { Button } from "@/components/ui/button"
import { MapCanvas } from "./map-canvas"

// Address text, and a map behind a button so no tile loads until it is asked for.
export function LocationBlock({
  cityId,
  address,
  location,
  approximate = false,
}: {
  cityId: string
  address?: string
  location: Geo | null
  // The seller's exact spot is hidden from visitors (rounded to about 1 km), so the map says so.
  approximate?: boolean
}) {
  const { t } = useT()
  const city = useCityName(cityId)
  const [open, setOpen] = useState(false)
  const markers = useMemo(
    () => (location ? [{ id: "place", ...location }] : []),
    [location]
  )
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-body">
        <MapPinIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
        <span>{[address, city].filter(Boolean).join(", ")}</span>
      </p>
      {approximate && location && (
        <p className="text-caption text-muted-foreground">
          {t("listing.location_approx")}
        </p>
      )}
      {location && (
        <>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {t(open ? "common.hide_map" : "common.view_on_map")}
          </Button>
          {open && (
            <MapCanvas
              center={location}
              zoom={15}
              markers={markers}
              label={t("form.map_label")}
            />
          )}
        </>
      )}
    </div>
  )
}
