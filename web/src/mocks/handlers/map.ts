import { arrayKeys, searchParamsSchema } from "@sayaratak/shared/search/schemas"
import {
  mapResponseSchema,
  type MapPoint,
} from "@sayaratak/shared/schemas/responses"
import { both } from "@/mocks/seed/util"

import { db } from "../db"
import { queryObject, route } from "../http"
import { listed } from "../lib"
import { matches, tierOf } from "../search"

const MAX_POINTS = 300
const allLayers = ["vehicles", "dealerships", "workshops", "mechanics"]

// `layers` repeats like every array param, `bbox` is "west,south,east,north". The vehicle layer also takes the search filters. Anyone but the owner gets listing positions rounded to 2 decimals (about 1 km).
route("GET", "/map", (c) => {
  const asked = c.query.getAll("layers").flatMap((l) => l.split(","))
  const layers = new Set(asked.length ? asked : allLayers)
  const [west = -180, south = -90, east = 180, north = 90] = (
    c.query.get("bbox") ?? ""
  )
    .split(",")
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  const inside = (
    p: { lat: number; lng: number } | null
  ): p is { lat: number; lng: number } =>
    Boolean(
      p && p.lng >= west && p.lng <= east && p.lat >= south && p.lat <= north
    )
  const round2 = (n: number) => Math.round(n * 100) / 100
  const points: MapPoint[] = []
  if (layers.has("vehicles")) {
    const filters = searchParamsSchema.parse({
      ...queryObject(c.query, arrayKeys),
      kind: "vehicle",
    })
    const listings = db.listings
      .filter((l) => matches(l, filters))
      .sort((a, b) => tierOf(b) - tierOf(a))
    for (const l of listings)
      if (inside(l.location)) {
        const own = c.user?.id === l.ownerUserId || c.user?.role === "admin"
        const cover = l.media[0]
        points.push({
          id: l.id,
          kind: "vehicle",
          title: both(l.title),
          slug: l.slug,
          location: own
            ? l.location
            : { lat: round2(l.location.lat), lng: round2(l.location.lng) },
          price: l.price,
          rating: null,
          photoUrl:
            (cover?.type === "video" ? cover.posterUrl : cover?.url) ?? null,
        })
      }
  }
  const businesses = [
    ["dealerships", "dealership", db.dealerships],
    ["workshops", "workshop", db.workshops],
  ] as const
  for (const [layer, kind, rows] of businesses) {
    if (!layers.has(layer)) continue
    for (const b of rows)
      if (listed(b) && inside(b.location))
        points.push({
          id: b.id,
          kind,
          title: b.name,
          slug: b.slug,
          location: b.location,
          price: null,
          rating: b.rating.count ? b.rating.avg : null,
          photoUrl: b.logoUrl,
        })
  }
  // Mechanics have no pin of their own: they sit at the center of their city.
  if (layers.has("mechanics")) {
    for (const m of db.mechanics) {
      const city = db.taxonomy.cities.find((x) => x.id === m.cityId)
      if (listed(m) && city && inside(city.center))
        points.push({
          id: m.id,
          kind: "mechanic",
          title: m.name,
          slug: m.slug,
          location: city.center,
          price: null,
          rating: m.rating.count ? m.rating.avg : null,
          photoUrl: m.photoUrl,
        })
    }
  }
  return mapResponseSchema.parse({
    items: points.slice(0, MAX_POINTS),
    total: points.length,
  })
})
