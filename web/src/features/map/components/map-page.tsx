import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ListIcon } from "lucide-react"

import { taxonomyQuery } from "@/features/listings/queries"
import { useDebounced } from "@/hooks/use-debounced"
import { useT } from "@/lib/i18n/use-t"
import { defaultCenter } from "@/lib/map"
import type { MapPoint } from "@sayaratak/shared/schemas/responses"
import {
  MapCanvas,
  type MapMarker,
  type MapShape,
  type MapView,
} from "@/components/app/map-canvas"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { mapQuery } from "../queries"
import { MAP_LAYERS, mapFilterSchema, type MapSearch } from "../schemas"
import { MapPopup } from "./map-popup"
import { MapResults } from "./map-results"
import { MapToolbar, type Place } from "./map-toolbar"

const shapes: Record<MapPoint["kind"], MapShape> = {
  vehicle: "circle",
  dealership: "square",
  workshop: "diamond",
  mechanic: "triangle",
}
const round = (n: number, digits: number) => Number(n.toFixed(digits))

// Pins and the list come from one query for the area on screen. The viewport lives in the URL; `target` is only where the map is told to go (a city, the device, a pressed row).
export function MapPage({
  search,
  onChange,
}: {
  search: MapSearch
  onChange: (next: MapSearch) => void
}) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const layers = search.layers ?? MAP_LAYERS
  const cityCenter = (id?: string) =>
    tax?.cities.find((c) => c.id === id)?.center

  const [target, setTarget] = useState(() => {
    if (search.lat !== undefined && search.lng !== undefined)
      return { lat: search.lat, lng: search.lng, zoom: search.zoom ?? 12 }
    const city = cityCenter(search.city)
    return city ? { ...city, zoom: 12 } : { ...defaultCenter, zoom: 11 }
  })
  const [view, setView] = useState<MapView | null>(null)
  const [selected, setSelected] = useState<MapPoint | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [place, setPlace] = useState<Place>("idle")

  // Pins are fetched 300 ms after the map stops moving, and not before the first view is known.
  const settled = useDebounced(view)
  const bbox = settled
    ? [
        settled.bounds.west,
        settled.bounds.south,
        settled.bounds.east,
        settled.bounds.north,
      ]
        .map((n) => n.toFixed(4))
        .join(",")
    : undefined
  const list = useQuery({
    ...mapQuery({
      ...mapFilterSchema.parse(search),
      layers: [...layers],
      bbox,
    }),
    enabled: Boolean(bbox),
  })
  const items = list.data?.items
  const total = list.data?.total ?? 0

  // Written back with `replace` so panning never fills the history.
  useEffect(() => {
    if (!settled) return
    const lat = round(settled.center.lat, 5)
    const lng = round(settled.center.lng, 5)
    if (
      search.lat !== lat ||
      search.lng !== lng ||
      search.zoom !== settled.zoom
    )
      onChange({ ...search, lat, lng, zoom: settled.zoom })
    // `search` and `onChange` change every render; only a settled view should write.
  }, [settled])

  const markers = useMemo<MapMarker[]>(
    () =>
      (items ?? []).map((p) => ({
        id: p.id,
        lat: p.location.lat,
        lng: p.location.lng,
        label: p.title[locale],
        shape: shapes[p.kind],
      })),
    [items, locale]
  )

  const pick = (p: MapPoint) => {
    setSelected(p)
    setListOpen(false)
    setTarget({ ...p.location, zoom: Math.max(view?.zoom ?? 0, 14) })
  }
  const locate = () => {
    if (!("geolocation" in navigator)) return setPlace("failed")
    setPlace("locating")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace("idle")
        setTarget({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          zoom: 13,
        })
      },
      (err) =>
        setPlace(err.code === err.PERMISSION_DENIED ? "denied" : "failed"),
      { timeout: 10_000 }
    )
  }
  const city = (id: string) => {
    onChange({ ...search, city: id || undefined })
    const center = cityCenter(id)
    if (center) setTarget({ ...center, zoom: 12 })
  }

  const results = (
    <MapResults
      items={items ?? []}
      total={total}
      stale={list.isPlaceholderData}
      pending={list.isPending}
      failed={list.isError}
      selectedId={selected?.id}
      onPick={pick}
      onRetry={() => void list.refetch()}
    />
  )

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-96 flex-col gap-3 py-3 md:h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">{t("map.title")}</h1>
      <MapToolbar
        search={search}
        layers={layers}
        place={place}
        onChange={onChange}
        onCity={city}
        onLocate={locate}
      />
      <div className="flex min-h-0 flex-1 gap-4">
        <aside
          aria-label={t("map.list_title")}
          className="hidden w-[360px] shrink-0 flex-col gap-3 lg:flex"
        >
          <h2 className="text-title font-semibold">
            {t("map.in_area", { count: total })}
          </h2>
          {results}
        </aside>
        <MapCanvas
          className="h-full min-w-0 flex-1"
          label={t("form.map_label")}
          center={target}
          zoom={target.zoom}
          cluster
          eager
          markers={markers}
          selectedId={selected?.id ?? null}
          onSelect={(id) =>
            setSelected(items?.find((p) => p.id === id) ?? null)
          }
          onMove={setView}
          popup={
            selected && (
              <MapPopup point={selected} onClose={() => setSelected(null)} />
            )
          }
        />
      </div>
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p aria-live="polite" className="text-ui">
          {t("map.in_area", { count: total })}
        </p>
        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetTrigger render={<Button variant="outline" />}>
            <ListIcon data-icon="inline-start" />
            {t("map.list")}
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="px-4 pb-4 data-[side=bottom]:h-[70dvh]"
          >
            <SheetHeader className="px-0">
              <SheetTitle>{t("map.list_title")}</SheetTitle>
            </SheetHeader>
            {results}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
