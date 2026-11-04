import {
  flagKeys,
  type FlagKey,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"
import { db } from "./db"
import type { ListingRow } from "./types"

type Skip = "type" | "make" | "fuel" | "transmission" | "city"
const skips: Record<Skip, string[]> = {
  type: ["type"],
  make: ["make", "model"],
  fuel: ["fuel"],
  transmission: ["transmission"],
  city: ["city", "district"],
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

const names = (id: string | null) => {
  const m =
    db.taxonomy.makes.find((x) => x.id === id) ??
    db.taxonomy.models.find((x) => x.id === id)
  return m ? `${m.name.ar} ${m.name.en}` : ""
}
const text = (l: ListingRow) =>
  `${l.title} ${l.description.ar} ${l.description.en} ${names(l.makeId)} ${names(l.modelId)}`.toLowerCase()

// Anyone sees an approved listing unless its owner is banned or its business is suspended.
export const isPublic = (l: ListingRow) =>
  l.moderation === "approved" &&
  !db.users.some((u) => u.id === l.ownerUserId && u.banned) &&
  ![...db.dealerships, ...db.workshops, ...db.mechanics].some(
    (b) => b.ownerId === l.ownerUserId && b.status === "suspended"
  )

// A vehicle has one type; a part fits one or more.
const typesOf = (l: ListingRow) =>
  l.kind === "part" ? l.compatibleTypes : l.vehicleType ? [l.vehicleType] : []

// A yes-only filter keeps listings whose own field says yes.
const flagTests: Record<FlagKey, (l: ListingRow) => boolean> = {
  customs: (l) => l.customsCleared === true,
  accidentFree: (l) => l.accidentFree === true,
  registered: (l) => l.registered === true,
  firstOwner: (l) => l.previousOwners === 0,
  fullService: (l) => l.serviceHistory === "full",
  warranty: (l) => !!l.warranty && l.warranty !== "none",
  exchange: (l) => l.exchange === true,
  financing: (l) => l.financing === true,
  insuranceIncluded: (l) => l.insuranceIncluded === true,
  delivery: (l) => l.delivery === true,
  installation: (l) => l.installation === true,
}
// An empty list is no filter; otherwise the listing's value must be one of them.
const oneOf = (list: string[] | undefined, value: string | null) =>
  !list?.length || (value !== null && list.includes(value))

export function matches(l: ListingRow, p: SearchParams, skip: string[] = []) {
  const on = (key: string) => !skip.includes(key)
  if (!isPublic(l) || l.kind !== p.kind) return false
  if (!p.includeSold && (l.status === "sold" || l.status === "rented"))
    return false
  if (p.intent && l.intent !== p.intent) return false
  if (on("type") && p.type && !typesOf(l).includes(p.type)) return false
  if (on("city") && p.city && l.cityId !== p.city) return false
  if (on("district") && p.district && l.districtId !== p.district) return false
  if (on("make") && p.make && l.makeId !== p.make) return false
  if (on("model") && p.model && l.modelId !== p.model) return false
  if (p.minPrice !== undefined && l.price < p.minPrice) return false
  if (p.maxPrice !== undefined && l.price > p.maxPrice) return false
  if (p.minYear !== undefined && (l.year ?? 0) < p.minYear) return false
  if (p.maxYear !== undefined && (l.year ?? 9999) > p.maxYear) return false
  if (p.maxMileage !== undefined && (l.mileageKm ?? 0) > p.maxMileage)
    return false
  if (on("fuel") && p.fuel?.length && (!l.fuel || !p.fuel.includes(l.fuel)))
    return false
  if (
    on("transmission") &&
    p.transmission?.length &&
    (!l.transmission || !p.transmission.includes(l.transmission))
  )
    return false
  if (p.condition && l.condition !== p.condition) return false
  if (p.partCategory && l.partCategoryId !== p.partCategory) return false
  if (p.verifiedOnly && !l.owner.verified) return false
  if (p.hasVideo && !l.media.some((m) => m.type === "video")) return false
  if (
    !oneOf(p.body, l.bodyType) ||
    !oneOf(p.drive, l.driveType) ||
    !oneOf(p.madeIn, l.origin) ||
    !oneOf(p.driver, l.driver) ||
    !oneOf(p.partType, l.partType)
  )
    return false
  const equipment: string[] = l.features
  if (p.features?.some((f) => !equipment.includes(f))) return false
  if (p.seatsMin !== undefined && (l.seats ?? 0) < p.seatsMin) return false
  if (
    p.fitsYear !== undefined &&
    ((l.fitsYearFrom ?? 0) > p.fitsYear || (l.fitsYearTo ?? 9999) < p.fitsYear)
  )
    return false
  if (flagKeys.some((k) => p[k] && !flagTests[k](l))) return false
  if (p.featured && !activePromotions(l).some((x) => x.type === "featured"))
    return false
  if (p.seller && l.owner.id !== p.seller && l.ownerUserId !== p.seller)
    return false
  if (p.q) {
    const hay = text(l)
    if (
      !p.q
        .toLowerCase()
        .split(/\s+/)
        .every((word) => hay.includes(word))
    )
      return false
  }
  if (p.radius && p.lat !== undefined && p.lng !== undefined) {
    if (
      !l.location ||
      haversineKm({ lat: p.lat, lng: p.lng }, l.location) > p.radius
    )
      return false
  }
  return true
}

const activePromotions = (l: ListingRow, now = Date.now()) =>
  l.promotions.filter(
    (x) => Date.parse(x.startsAt) <= now && Date.parse(x.endsAt) >= now
  )
export const tierOf = (l: ListingRow, now = Date.now()) =>
  Number(activePromotions(l, now).some((x) => x.type === "featured"))
// A bump puts a listing back at the top as if it had just been posted.
const posted = (l: ListingRow) => l.bumpedAt ?? l.createdAt
const newest = (a: ListingRow, b: ListingRow) =>
  posted(b).localeCompare(posted(a))

// A4 ranking: paid tier first, then listings with photos, then newest.
const ranked = (a: ListingRow, b: ListingRow) =>
  tierOf(b) - tierOf(a) ||
  Number(b.media.length > 0) - Number(a.media.length > 0) ||
  newest(a, b)

// Hash of the listing id and the hour: Featured listings take turns, in an order that changes every hour and stays the same while a buyer pages through.
const HOUR_MS = 3_600_000
const turn = (id: string, now: number) => {
  let h = Math.floor(now / HOUR_MS)
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16_777_619)
  return h >>> 0
}

// Featured listings never fill a whole page: each page of 24 opens with a row of up to 4 featured, then a featured leads each later row of 4 at most; the rest go by ranking. Leftover featured listings move to later pages, still ahead of their organic peers there.
const PAGE = 24
export function capPaid(sorted: ListingRow[], now = Date.now()) {
  const featured = sorted
    .filter((l) => tierOf(l) > 0)
    .sort((a, b) => turn(a.id, now) - turn(b.id, now))
  const organic = sorted.filter((l) => tierOf(l) === 0)
  const out: ListingRow[] = []
  for (let i = 0; i < sorted.length; i++) {
    const slot = i % PAGE
    const order =
      slot < 4 || slot % 4 === 0 ? [featured, organic] : [organic, featured]
    const next = order.find((q) => q.length > 0)?.shift()
    if (next) out.push(next)
  }
  return out
}

export function sortListings(rows: ListingRow[], p: SearchParams) {
  const origin =
    p.lat !== undefined && p.lng !== undefined
      ? { lat: p.lat, lng: p.lng }
      : null
  const km = (l: ListingRow) =>
    origin && l.location ? haversineKm(origin, l.location) : Infinity
  const sorts: Record<
    SearchParams["sort"],
    (a: ListingRow, b: ListingRow) => number
  > = {
    relevance: ranked,
    newest,
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    year_desc: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    mileage_asc: (a, b) => (a.mileageKm ?? 0) - (b.mileageKm ?? 0),
    nearest: origin ? (a, b) => km(a) - km(b) : ranked,
  }
  const sorted = [...rows].sort(sorts[p.sort])
  return sorts[p.sort] === ranked ? capPaid(sorted) : sorted
}

const countBy = (
  rows: ListingRow[],
  value: (l: ListingRow) => string | string[] | null
) => {
  const counts = new Map<string, number>()
  for (const l of rows)
    for (const v of [value(l)].flat())
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts]
    .map(([v, count]) => ({ value: v, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

// Counts per facet value are computed without that facet's own filter.
export function facets(p: SearchParams) {
  const rows = (key: Skip) =>
    db.listings.filter((l) => matches(l, p, skips[key]))
  return {
    type: countBy(rows("type"), typesOf),
    make: countBy(rows("make"), (l) => l.makeId),
    fuel: countBy(rows("fuel"), (l) => l.fuel),
    transmission: countBy(rows("transmission"), (l) => l.transmission),
    city: countBy(rows("city"), (l) => l.cityId),
  }
}
