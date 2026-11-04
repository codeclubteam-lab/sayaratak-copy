import { useEffect, useMemo, useRef } from "react"
import L from "leaflet"
import "leaflet.markercluster"
import "leaflet/dist/leaflet.css"
import "leaflet.markercluster/dist/MarkerCluster.css"
import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"

import { useT } from "@/lib/i18n/use-t"
import { tileAttribution, tileUrl } from "@/lib/map"
import type { MapCanvasProps, MapShape } from "./map-canvas"

// A divIcon avoids Leaflet's default marker images, which bundlers do not resolve.
const icon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:var(--primary);border:3px solid var(--card);box-shadow:0 1px 4px color-mix(in oklch, var(--foreground) 40%, transparent)"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// One filled shape per kind, card-colored outline. The paths are fixed text, never built from data.
const shapes: Record<MapShape, string> = {
  circle: '<circle cx="14" cy="14" r="10"/>',
  square: '<rect x="5" y="5" width="18" height="18" rx="3"/>',
  diamond: '<polygon points="14,2 26,14 14,26 2,14"/>',
  triangle: '<polygon points="14,3 26,24 2,24"/>',
}
const shapeIcon = (shape: MapShape) =>
  L.divIcon({
    className: "",
    html: `<svg width="28" height="28" viewBox="0 0 28 28" fill="${shape === "circle" ? "var(--primary)" : "var(--foreground)"}" stroke="var(--card)" stroke-width="2.5" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px color-mix(in oklch, var(--foreground) 40%, transparent))">${shapes[shape]}</svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
const icons = {
  circle: shapeIcon("circle"),
  square: shapeIcon("square"),
  diamond: shapeIcon("diamond"),
  triangle: shapeIcon("triangle"),
}

// Clusters use the same neutral tokens as the pins (the plugin's own green, yellow and orange would clash with the palette).
const clusterIcon = (count: number) =>
  L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:36px;height:36px;border-radius:9999px;background:var(--foreground);color:var(--background);border:3px solid var(--card);font:600 14px/1 var(--font-sans, sans-serif)">${count}</span>`,
    iconSize: [36, 36],
  })

function Events({ onMove, onPick }: Pick<MapCanvasProps, "onMove" | "onPick">) {
  const map = useMap()
  const report = () => {
    const c = map.getCenter()
    const b = map.getBounds()
    onMove?.({
      center: { lat: c.lat, lng: c.lng },
      zoom: map.getZoom(),
      bounds: {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      },
    })
  }
  useMapEvents({
    click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    // Keyboard users pin the center of the map; arrow keys pan it.
    keypress: (e) => {
      if (e.originalEvent.key === "Enter") {
        const c = map.getCenter()
        onPick?.({ lat: c.lat, lng: c.lng })
      }
    },
    moveend: report,
  })
  // The first view is reported too, so a page can ask for what is on screen before anyone pans.
  useEffect(report, [])
  return null
}

// Follows the `center` prop when it changes from outside (a new city), but ignores the echo of the person's own panning.
function Recenter({ center, zoom }: Pick<MapCanvasProps, "center" | "zoom">) {
  const map = useMap()
  useEffect(() => {
    if (map.getCenter().distanceTo([center.lat, center.lng]) > 1)
      map.setView([center.lat, center.lng], zoom ?? map.getZoom())
  }, [center.lat, center.lng, zoom])
  return null
}

function Markers({
  markers,
  cluster,
  onSelect,
}: Pick<MapCanvasProps, "markers" | "cluster" | "onSelect">) {
  const map = useMap()
  // Markers are rebuilt only when the list changes, so the latest handler is read through a ref.
  const select = useRef(onSelect)
  select.current = onSelect
  useEffect(() => {
    const group = cluster
      ? L.markerClusterGroup({
          iconCreateFunction: (c) => clusterIcon(c.getChildCount()),
        })
      : L.layerGroup()
    for (const m of markers ?? []) {
      const marker = L.marker([m.lat, m.lng], {
        icon: m.shape ? icons[m.shape] : icon,
        title: m.label,
      })
      marker.on("click", () => select.current?.(m.id))
      group.addLayer(marker)
    }
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, markers, cluster])
  return null
}

// The popup is a layer of its own, anchored at the selected marker, so it survives a marker being folded into a cluster. Its content is the page's React tree.
function Selected({
  markers,
  selectedId,
  onSelect,
  popup,
}: Pick<MapCanvasProps, "markers" | "selectedId" | "onSelect" | "popup">) {
  const marker = markers?.find((m) => m.id === selectedId)
  // The selection ends when the map is pressed or Escape is pressed. `popupclose` is not used: React removing the popup (a hot reload, strict mode) fires it too.
  useMapEvents({
    click: () => onSelect?.(null),
    keydown: (e) => {
      if (e.originalEvent.key === "Escape") onSelect?.(null)
    },
  })
  // A new `position` array on every render would close and reopen the popup each time, so it is kept by value.
  const position = useMemo(
    () => (marker ? L.latLng(marker.lat, marker.lng) : null),
    [marker?.lat, marker?.lng]
  )
  if (!position || !popup) return null
  return (
    <Popup position={position} closeButton={false} offset={[0, -8]}>
      {popup}
    </Popup>
  )
}

export function MapCanvasImpl({
  center,
  zoom = 12,
  markers,
  cluster,
  pin,
  onMove,
  onPick,
  selectedId,
  onSelect,
  popup,
  label,
}: MapCanvasProps) {
  const { t } = useT()
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className="size-full"
      aria-label={label}
    >
      <TileLayer url={tileUrl} attribution={tileAttribution} />
      <Events onMove={onMove} onPick={onPick} />
      <Recenter center={center} zoom={zoom} />
      <Markers markers={markers} cluster={cluster} onSelect={onSelect} />
      <Selected
        markers={markers}
        selectedId={selectedId}
        onSelect={onSelect}
        popup={popup}
      />
      {pin && (
        <Marker
          position={[pin.lat, pin.lng]}
          icon={icon}
          title={t("form.pin_label")}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng()
              onPick?.({ lat: p.lat, lng: p.lng })
            },
          }}
        />
      )}
    </MapContainer>
  )
}
