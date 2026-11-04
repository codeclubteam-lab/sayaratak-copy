// Twice the Earth's mean radius in kilometers, as in the mock's formula.
const DIAMETER_KM = 12742

/**
 * Great-circle distance in kilometers (haversine), the mock's `haversineKm`.
 * Example: two points 0.01 degrees of latitude apart are about 1.1 km apart.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return DIAMETER_KM * Math.asin(Math.sqrt(h))
}
