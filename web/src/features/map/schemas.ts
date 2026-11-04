import { z } from "zod"

import { optional, searchParamsSchema } from "@sayaratak/shared/search/schemas"

export const MAP_LAYERS = [
  "vehicles",
  "dealerships",
  "workshops",
  "mechanics",
] as const
export type MapLayer = (typeof MAP_LAYERS)[number]

// `layers` has no default here: the router writes a validated search back into the URL, so a default would turn `/map` into `/map?layers=...`. The page reads `search.layers ?? MAP_LAYERS`.
export const mapSearchSchema = searchParamsSchema
  .pick({
    intent: true,
    type: true,
    make: true,
    model: true,
    minPrice: true,
    maxPrice: true,
    minYear: true,
    maxYear: true,
    city: true,
  })
  .extend({
    layers: optional(z.array(z.enum(MAP_LAYERS)).min(1)),
    lat: optional(z.coerce.number()),
    lng: optional(z.coerce.number()),
    zoom: optional(z.coerce.number().int().min(3).max(18)),
  })
export type MapSearch = z.infer<typeof mapSearchSchema>

// What the vehicles layer filters on; the viewport is not a filter.
export const mapFilterSchema = mapSearchSchema.omit({
  lat: true,
  lng: true,
  zoom: true,
})
