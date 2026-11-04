import type { SearchParams } from "@sayaratak/shared/search/schemas"
import {
  and,
  arrayContains,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { detailsWhere } from "./listings.details.queries"
import { listingMedia, listings } from "./listings.tables"

/** What the search needs from other modules, already read as id lists. */
export type SearchScope = {
  hiddenOwnerIds: string[]
  featuredIds: string[]
  /** People with a verified phone, and owners of a verified dealership. */
  verified: { userIds: string[]; dealershipOwnerIds: string[] }
  videoIds: string[]
}

// A filter group that facets switch off for their own counts (mock `skips`).
export type FacetKey = "type" | "make" | "fuel" | "transmission" | "city"
const SKIPPED: Record<FacetKey, string[]> = {
  type: ["type"],
  make: ["make", "model"],
  fuel: ["fuel"],
  transmission: ["transmission"],
  city: ["city", "district"],
}
// Earth's diameter in km, as the mock's haversine.
const EARTH_DIAMETER_KM = 12742
const KM_PER_DEGREE = 111.2

/**
 * The SQL `WHERE` of a public search, rule for rule the mock's `matches`.
 * `skip` names a facet whose own filter is left out (disjunctive facets).
 */
export function searchWhere(
  p: SearchParams,
  scope: SearchScope,
  skip?: FacetKey
) {
  const on = (key: string) => !skip || !SKIPPED[skip].includes(key)
  return and(
    eq(listings.moderation, "approved"),
    eq(listings.kind, p.kind),
    scope.hiddenOwnerIds.length > 0
      ? notInArray(listings.ownerUserId, scope.hiddenOwnerIds)
      : undefined,
    p.includeSold
      ? undefined
      : inArray(listings.status, ["available", "reserved"]),
    p.intent ? eq(listings.intent, p.intent) : undefined,
    on("type") ? typeWhere(p) : undefined,
    ...placeWhere(p, on),
    ...rangeWhere(p),
    ...attributeWhere(p, on),
    p.seller ? eq(listings.ownerUserId, p.seller) : undefined,
    ...scopeWhere(p, scope),
    ...detailsWhere(p),
    ...wordsWhere(p.q),
    radiusWhere(p)
  )
}

/** Distance in km from the search point, null without a pin (sorts last). */
export function distanceKm(origin: { lat: number; lng: number }) {
  // Haversine, the same formula as the mock: 2r * asin(sqrt(h)).
  return sql<number>`${EARTH_DIAMETER_KM} * asin(sqrt(
    power(sin(radians(${listings.lat} - ${origin.lat}) / 2), 2) +
    cos(radians(${origin.lat})) * cos(radians(${listings.lat})) *
    power(sin(radians(${listings.lng} - ${origin.lng}) / 2), 2)
  ))`
}

/** 1 for a listing with at least one photo or video, else 0 (relevance ranks them first). */
export function hasMedia() {
  return sql<number>`(exists (select 1 from ${listingMedia} where ${listingMedia.listingId} = ${listings.id}))::int`
}

function attributeWhere(p: SearchParams, on: (key: string) => boolean) {
  return [
    on("fuel") && p.fuel?.length ? inArray(listings.fuel, p.fuel) : undefined,
    on("transmission") && p.transmission?.length
      ? inArray(listings.transmission, p.transmission)
      : undefined,
    p.condition ? eq(listings.condition, p.condition) : undefined,
    p.partCategory ? eq(listings.partCategoryId, p.partCategory) : undefined,
  ]
}

// A person's listing is verified by their phone, a dealership's by the business.
export function verifiedWhere(verified: SearchScope["verified"]) {
  return or(
    and(
      eq(listings.ownerType, "user"),
      inArray(listings.ownerUserId, [...verified.userIds, ""])
    ),
    and(
      eq(listings.ownerType, "dealership"),
      inArray(listings.ownerUserId, [...verified.dealershipOwnerIds, ""])
    )
  )
}

function typeWhere(p: SearchParams) {
  if (!p.type) return undefined
  // A vehicle has one type; a part fits one or more.
  return p.kind === "part"
    ? arrayContains(listings.compatibleTypes, [p.type])
    : eq(listings.vehicleType, p.type)
}

function placeWhere(p: SearchParams, on: (key: string) => boolean) {
  return [
    on("city") && p.city ? eq(listings.cityId, p.city) : undefined,
    on("district") && p.district
      ? eq(listings.districtId, p.district)
      : undefined,
    on("make") && p.make ? eq(listings.makeId, p.make) : undefined,
    on("model") && p.model ? eq(listings.modelId, p.model) : undefined,
  ]
}

// The mock reads a missing year as 0 for "from" and 9999 for "to", a missing mileage as 0.
function rangeWhere(p: SearchParams) {
  return [
    p.minPrice === undefined ? undefined : gte(listings.price, p.minPrice),
    p.maxPrice === undefined ? undefined : lte(listings.price, p.maxPrice),
    p.minYear === undefined
      ? undefined
      : sql`coalesce(${listings.year}, 0) >= ${p.minYear}`,
    p.maxYear === undefined
      ? undefined
      : sql`coalesce(${listings.year}, 9999) <= ${p.maxYear}`,
    p.maxMileage === undefined
      ? undefined
      : sql`coalesce(${listings.mileageKm}, 0) <= ${p.maxMileage}`,
  ]
}

function scopeWhere(p: SearchParams, scope: SearchScope) {
  return [
    p.verifiedOnly ? verifiedWhere(scope.verified) : undefined,
    p.featured ? inArray(listings.id, [...scope.featuredIds, ""]) : undefined,
    p.hasVideo
      ? sql`exists (select 1 from ${listingMedia} where ${listingMedia.listingId} = ${listings.id} and ${inArray(listingMedia.uploadId, [...scope.videoIds, ""])})`
      : undefined,
  ]
}

// `q`: every word must appear in the search text (lowercased, as the mock).
// `%`, `_` and `\` are escaped so a word matches only itself.
function wordsWhere(q: string | undefined) {
  if (!q) return []
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        sql`${listings.searchText} like ${`%${word.replace(/[\\%_]/g, "\\$&")}%`}`
    )
}

// A bounding box first (btree on lat and lng), then the exact distance.
function radiusWhere(p: SearchParams) {
  if (!p.radius || p.lat === undefined || p.lng === undefined) return undefined
  const latSpan = p.radius / KM_PER_DEGREE
  const lngSpan =
    p.radius /
    (KM_PER_DEGREE * Math.max(Math.cos((p.lat * Math.PI) / 180), 0.01))
  return and(
    isNotNull(listings.lat),
    sql`${listings.lat} between ${p.lat - latSpan} and ${p.lat + latSpan}`,
    sql`${listings.lng} between ${p.lng - lngSpan} and ${p.lng + lngSpan}`,
    sql`${distanceKm({ lat: p.lat, lng: p.lng })} <= ${p.radius}`
  )
}

/** Whether the listing is one of the public search results for these filters (the saved-search match). */
export async function matchesSearch(
  ex: Executor,
  find: { id: string; params: SearchParams; scope: SearchScope }
) {
  const where = and(
    eq(listings.id, find.id),
    searchWhere(find.params, find.scope)
  )
  return (await ex.$count(listings, where)) > 0
}
