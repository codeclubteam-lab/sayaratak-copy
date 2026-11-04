import type { Listing } from "@sayaratak/shared/schemas/listing"
import type { MapPoint } from "@sayaratak/shared/schemas/responses"

import type { ListingRow } from "./listings.tables"

export type ListingParts = {
  row: ListingRow
  stats: Listing["stats"]
  media: Listing["media"]
  promotions: Listing["promotions"]
  owner: Listing["owner"]
  /** Already rounded for viewers other than the owner and admins. */
  location: Listing["location"]
}

/** A listing in `listingSchema` key order, as the mock answers it. */
export function toListing(parts: ListingParts): Listing {
  const { row } = parts
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    intent: row.intent,
    vehicleType: row.vehicleType,
    title: row.title,
    description: row.description,
    price: row.price,
    negotiable: row.negotiable,
    rentPeriod: row.rentPeriod,
    condition: row.condition,
    ...specsOf(row),
    ...row.details,
    partCategoryId: row.partCategoryId,
    compatibleTypes: row.compatibleTypes,
    media: parts.media,
    cityId: row.cityId,
    districtId: row.districtId,
    location: parts.location,
    status: row.status,
    moderation: row.moderation,
    rejectionReason: row.rejectionReason,
    promotions: parts.promotions,
    owner: parts.owner,
    contact: row.contact,
    stats: parts.stats,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }
}

// The vehicle and part fields with their own columns, in schema order.
function specsOf(row: ListingRow) {
  return {
    makeId: row.makeId,
    modelId: row.modelId,
    makeOther: row.makeOther,
    modelOther: row.modelOther,
    year: row.year,
    mileageKm: row.mileageKm,
    fuel: row.fuel,
    transmission: row.transmission,
    color: row.color,
    engineCc: row.engineCc,
    payloadTons: row.payloadTons,
    partNumber: row.partNumber,
  }
}

/** A listing as a vehicle map point; the cover of a video is its poster. */
export function toMapPoint(
  listing: Listing & { location: NonNullable<Listing["location"]> }
): MapPoint {
  const cover = listing.media[0]
  return {
    id: listing.id,
    kind: "vehicle",
    // Listing titles are one string; the mock sends it in both slots.
    title: { ar: listing.title, en: listing.title },
    slug: listing.slug,
    location: listing.location,
    price: listing.price,
    rating: null,
    photoUrl: (cover?.type === "video" ? cover.posterUrl : cover?.url) ?? null,
  }
}
