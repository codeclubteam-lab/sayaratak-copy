import { lazy, Suspense, useState, type ReactNode } from "react"
import { ClientOnly } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { usePrefs } from "@/lib/prefs"
import { cn } from "@/lib/utils"
import type { Geo } from "@sayaratak/shared/schemas/fields"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// The pin shape tells kinds apart without color: a map must not rely on color alone.
export type MapShape = "circle" | "square" | "diamond" | "triangle"
export type MapMarker = {
  id: string
  lat: number
  lng: number
  label?: string
  shape?: MapShape
}
export type MapView = {
  center: Geo
  zoom: number
  bounds: { north: number; south: number; east: number; west: number }
}
export type MapCanvasProps = {
  center: Geo
  zoom?: number
  markers?: MapMarker[]
  cluster?: boolean
  // A single draggable pin, for pickers.
  pin?: Geo | null
  onMove?: (view: MapView) => void
  onPick?: (point: Geo) => void
  // A pressed marker reports its id; `popup` opens at the marker named by `selectedId`, and closing it reports null.
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  popup?: ReactNode
  // The map is the point of the page (the map search), so it loads at once even with data saver on.
  eager?: boolean
  label: string
  className?: string
}

// Leaflet touches `window` on import, so it loads in the browser only and never in the first bundle.
const Impl = lazy(() =>
  import("./map-canvas-impl").then((m) => ({ default: m.MapCanvasImpl }))
)

export function MapCanvas(props: MapCanvasProps) {
  const { t } = useT()
  const { dataSaver } = usePrefs()
  // With data saver on, no tile is requested until the person asks for the map, unless the page is the map.
  const [armed, setArmed] = useState(props.eager || !dataSaver)
  // `isolate` keeps Leaflet's own z-indexes (400 to 1000) inside the map, below the header, sheets and menus.
  const box = cn(
    "relative isolate w-full overflow-hidden rounded-lg bg-muted",
    props.className ?? "h-72"
  )
  if (!armed)
    return (
      <div className={`${box} grid place-items-center`}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setArmed(true)}
        >
          {t("form.load_map")}
        </Button>
      </div>
    )
  return (
    <div className={box}>
      <ClientOnly fallback={<Skeleton className="size-full" />}>
        <Suspense fallback={<Skeleton className="size-full" />}>
          <Impl {...props} />
        </Suspense>
      </ClientOnly>
    </div>
  )
}
