import type { SearchParams } from "@sayaratak/shared/search/schemas"

import { db } from "~/shared/db/client"
import { parseBox } from "~/shared/geo/box"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import { listVehiclePoints } from "~/modules/listings/listings.map.service"

// A11: the map answers 300 points at most; `total` counts them all.
const MAX_POINTS = 300
const ALL_LAYERS = ["vehicles", "dealerships", "workshops", "mechanics"]
const BUSINESS_LAYERS = new Set<string>([
  "dealerships",
  "workshops",
  "mechanics",
])

type MapQuery = {
  viewer: SessionUser | null
  /** Search filters for the vehicle layer; `kind` is always vehicle. */
  params: SearchParams
  /** Each `layers` value, any of them comma separated; none means every layer. */
  layers: string[]
  bbox: string | undefined
}

/**
 * `GET /map`: vehicles, dealerships, workshops and mechanics inside the box,
 * in that order, cut at 300. Unknown layer names are ignored, as the mock.
 * Example: `layers=vehicles,workshops&bbox=32.4,15.4,32.7,15.8`.
 */
export async function getMap(query: MapQuery) {
  const asked = query.layers.flatMap((layer) => layer.split(","))
  const layers = new Set(asked.length > 0 ? asked : ALL_LAYERS)
  const box = parseBox(query.bbox)
  const businessLayers = new Set(
    [...layers].filter((layer): layer is businesses.BusinessLayer =>
      BUSINESS_LAYERS.has(layer)
    )
  )
  // The layers are independent reads.
  const [vehicles, places] = await Promise.all([
    layers.has("vehicles")
      ? listVehiclePoints({
          viewer: query.viewer,
          params: { ...query.params, kind: "vehicle" },
          box,
          limit: MAX_POINTS,
        })
      : { points: [], total: 0 },
    businesses.listMapPoints(db, { layers: businessLayers, box }),
  ])
  return {
    items: [...vehicles.points, ...places].slice(0, MAX_POINTS),
    total: vehicles.total + places.length,
  }
}
