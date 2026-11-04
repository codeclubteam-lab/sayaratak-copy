import type { Geo } from "@sayaratak/shared/schemas/fields"
import type {
  Fuel,
  Transmission,
  VehicleType,
} from "@sayaratak/shared/schemas/listing"
import {
  flagKeys,
  type FlagKey,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"

// How many filters are set among these draft values: an array counts each choice, anything else counts once when it holds a value. It feeds the count on a section heading.
export const activeCount = (...values: unknown[]) =>
  values.reduce<number>(
    (n, v) =>
      n +
      (Array.isArray(v)
        ? v.length
        : v === null || v === undefined || v === "" || v === false
          ? 0
          : 1),
    0
  )

export const radii = [5, 10, 25, 50, 100] as const

// The part of the URL the filter form edits. Empty values are null or [], never undefined, so every field stays controlled.
export type FilterDraft = {
  type: VehicleType | null
  partCategory: string | null
  minPrice: number | null
  maxPrice: number | null
  make: string
  model: string
  minYear: number | null
  maxYear: number | null
  maxMileage: number | null
  fuel: Fuel[]
  transmission: Transmission[]
  condition: "new" | "used" | null
  city: string
  district: string | null
  radius: number | null
  // Where the radius counts from when no city gives it: the position in the URL, or the one the browser just reported.
  origin: Geo | null
  verifiedOnly: boolean
  hasVideo: boolean
  includeSold: boolean
  // Step 7.9 fields: the yes-only filters that are on, the multi-choice lists, and two numbers.
  flags: FlagKey[]
  body: string[]
  drive: string[]
  madeIn: string[]
  driver: string[]
  partType: string[]
  features: string[]
  seatsMin: number | null
  fitsYear: number | null
}

// The blocks of the filter form. A page that owns some filters (a profile's inventory) shows only the groups it can write to its URL.
export const filterGroups = [
  "category",
  "price",
  "make",
  "year",
  "mileage",
  "fuel",
  "condition",
  "location",
  "spec",
  "more",
] as const
export type FilterGroup = (typeof filterGroups)[number]

export const filterKeys = [
  "type",
  "partCategory",
  "minPrice",
  "maxPrice",
  "make",
  "model",
  "minYear",
  "maxYear",
  "maxMileage",
  "fuel",
  "transmission",
  "condition",
  "city",
  "district",
  "radius",
  "lat",
  "lng",
  "verifiedOnly",
  "hasVideo",
  "includeSold",
  "body",
  "drive",
  "madeIn",
  "driver",
  "partType",
  "features",
  "seatsMin",
  "fitsYear",
  ...flagKeys,
] as const satisfies readonly (keyof SearchParams)[]

export const toDraft = (p: SearchParams): FilterDraft => ({
  type: p.type ?? null,
  partCategory: p.partCategory ?? null,
  minPrice: p.minPrice ?? null,
  maxPrice: p.maxPrice ?? null,
  make: p.make ?? "",
  model: p.model ?? "",
  minYear: p.minYear ?? null,
  maxYear: p.maxYear ?? null,
  maxMileage: p.maxMileage ?? null,
  fuel: p.fuel ?? [],
  transmission: p.transmission ?? [],
  condition: p.condition ?? null,
  city: p.city ?? "",
  district: p.district ?? null,
  radius: p.radius ?? null,
  origin:
    p.lat !== undefined && p.lng !== undefined
      ? { lat: p.lat, lng: p.lng }
      : null,
  verifiedOnly: p.verifiedOnly ?? false,
  hasVideo: p.hasVideo ?? false,
  includeSold: p.includeSold,
  flags: flagKeys.filter((k) => p[k]),
  body: p.body ?? [],
  drive: p.drive ?? [],
  madeIn: p.madeIn ?? [],
  driver: p.driver ?? [],
  partType: p.partType ?? [],
  features: p.features ?? [],
  seatsMin: p.seatsMin ?? null,
  fitsYear: p.fitsYear ?? null,
})

const some = <T>(v: T | null | "") => (v === null || v === "" ? undefined : v)
const list = <T>(v: T[]) => (v.length ? v : undefined)
const ordered = (a: number | null, b: number | null) =>
  a !== null && b !== null && a > b ? [b, a] : [a, b]

// Draft back to URL params: empty values leave the URL, a reversed range is swapped, the page resets. A radius needs an origin: the chosen city's center, else the draft's position.
export function applyDraft(
  base: SearchParams,
  d: FilterDraft,
  center: Geo | undefined
): SearchParams {
  const [minPrice, maxPrice] = ordered(d.minPrice, d.maxPrice)
  const [minYear, maxYear] = ordered(d.minYear, d.maxYear)
  const origin = center ?? d.origin ?? undefined
  const radius = origin ? some(d.radius) : undefined
  return {
    ...base,
    type: some(d.type),
    partCategory: some(d.partCategory),
    minPrice: some(minPrice),
    maxPrice: some(maxPrice),
    make: some(d.make),
    model: d.make ? some(d.model) : undefined,
    minYear: some(minYear),
    maxYear: some(maxYear),
    maxMileage: some(d.maxMileage),
    fuel: list(d.fuel),
    transmission: list(d.transmission),
    condition: some(d.condition),
    city: some(d.city),
    district: d.city ? some(d.district) : undefined,
    radius,
    lat: radius ? origin?.lat : undefined,
    lng: radius ? origin?.lng : undefined,
    verifiedOnly: d.verifiedOnly || undefined,
    hasVideo: d.hasVideo || undefined,
    includeSold: d.includeSold,
    ...Object.fromEntries(
      flagKeys.map((k) => [k, d.flags.includes(k) || undefined])
    ),
    body: list(d.body),
    drive: list(d.drive),
    madeIn: list(d.madeIn),
    driver: list(d.driver),
    partType: list(d.partType),
    features: list(d.features),
    seatsMin: some(d.seatsMin),
    fitsYear: some(d.fitsYear),
    page: 1,
  }
}

// Drops filters but keeps what the search bar and the page own (kind, intent, q, seller, sort).
export function clearFilters(p: SearchParams): SearchParams {
  const next: SearchParams = { ...p, page: 1, includeSold: false }
  for (const k of filterKeys) if (k !== "includeSold") delete next[k]
  if (next.sort === "nearest") next.sort = "relevance"
  return next
}

// Straight-line distance for suggesting nearby cities; the mock keeps its own copy server side.
export function distanceKm(a: Geo, b: Geo) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
