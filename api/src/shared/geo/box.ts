/** A map viewport in degrees. */
export type Box = { west: number; south: number; east: number; north: number }

/**
 * Reads `bbox` ("west,south,east,north") the way the mock does: values that
 * are not numbers drop out and the rest shift left, missing ones take the
 * whole world. With no `bbox` at all the empty string reads as west 0.
 * Example: "32.4,15.4,32.7,15.8" is greater Khartoum.
 */
export function parseBox(bbox: string | undefined): Box {
  const [west = -180, south = -90, east = 180, north = 90] = (bbox ?? "")
    .split(",")
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  return { west, south, east, north }
}

export function inBox(box: Box, point: { lat: number; lng: number }) {
  return (
    point.lng >= box.west &&
    point.lng <= box.east &&
    point.lat >= box.south &&
    point.lat <= box.north
  )
}
