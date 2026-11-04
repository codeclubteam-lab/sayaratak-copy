import type { Media } from "@sayaratak/shared/schemas/listing"
import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"
import type { Rating } from "@sayaratak/shared/schemas/review"

import type {
  DealershipRow,
  MechanicRow,
  PortfolioRow,
  ServiceRow,
  WorkshopRow,
} from "./businesses.types"

/** What a profile shows besides its own columns; the service gathers it from other modules. */
type Shown = {
  rating: Rating
  // A banned owner's page still opens, with a notice and no contact (handoff "Visibility").
  unavailable: boolean
}

// Dealerships and workshops: an empty address pin is both coordinates missing.
const pinOf = (row: { lat: number | null; lng: number | null }) =>
  row.lat === null || row.lng === null ? null : { lat: row.lat, lng: row.lng }

// A banned owner's page shows no contact (handoff "Visibility"): the numbers never leave the server.
const WITHHELD_PHONE = ""
const contactOf = (row: { whatsapp: string | null }, shown: Shown) => ({
  whatsapp: shown.unavailable ? null : row.whatsapp,
})

// The optional wire keys: left out, not null, when there is nothing to show.
const flags = (row: { suspendedReason: string | null }, shown: Shown) => ({
  ...(row.suspendedReason !== null && { suspendedReason: row.suspendedReason }),
  ...(shown.unavailable && { unavailable: true as const }),
})

/** A dealership in `dealershipSchema`; `inventoryCount` is its approved listings still for sale. */
export function toDealership(
  row: DealershipRow,
  shown: Shown & { logoUrl: string; coverUrl: string; inventoryCount: number }
): Dealership {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.ownerUserId,
    name: row.name,
    logoUrl: shown.logoUrl,
    coverUrl: shown.coverUrl,
    description: row.description,
    cityId: row.cityId,
    districtId: row.districtId ?? "",
    address: row.address,
    location: pinOf(row),
    phones: shown.unavailable ? [] : row.phones,
    ...contactOf(row, shown),
    hours: row.hours,
    rating: shown.rating,
    verified: row.verified,
    inventoryCount: shown.inventoryCount,
    status: row.status,
    ...flags(row, shown),
    createdAt: row.createdAt.toISOString(),
  }
}

/** A workshop in `workshopSchema`, with its photos and services in the owner's order. */
export function toWorkshop(
  row: WorkshopRow,
  shown: Shown & {
    logoUrl: string
    coverUrl: string
    images: Media[]
    services: ServiceRow[]
  }
): Workshop {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.ownerUserId,
    name: row.name,
    logoUrl: shown.logoUrl,
    coverUrl: shown.coverUrl,
    description: row.description,
    cityId: row.cityId,
    districtId: row.districtId ?? "",
    address: row.address,
    location: pinOf(row),
    phone: shown.unavailable ? WITHHELD_PHONE : row.phone,
    ...contactOf(row, shown),
    hours: row.hours,
    images: shown.images,
    services: shown.services.map(toService),
    rating: shown.rating,
    verified: row.verified,
    status: row.status,
    ...flags(row, shown),
    createdAt: row.createdAt.toISOString(),
  }
}

/** One service row as `workshopSchema` lists it; `priceFrom` is left out when the owner set none. */
export function toService(row: ServiceRow): Workshop["services"][number] {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ...(row.priceFrom !== null && { priceFrom: row.priceFrom }),
    templateId: row.templateId,
  }
}

/** A mechanic in `mechanicSchema`; served cities and skills arrive in the order the mechanic picked them. */
export function toMechanic(
  row: MechanicRow,
  shown: Shown & {
    photoUrl: string
    servedCityIds: string[]
    specializationIds: string[]
    portfolio: Mechanic["portfolio"]
  }
): Mechanic {
  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.ownerUserId,
    name: row.name,
    photoUrl: shown.photoUrl,
    bio: row.bio,
    cityId: row.cityId,
    servedCityIds: shown.servedCityIds,
    yearsOfExperience: row.yearsOfExperience,
    specializationIds: shown.specializationIds,
    phone: shown.unavailable ? WITHHELD_PHONE : row.phone,
    ...contactOf(row, shown),
    portfolio: shown.portfolio,
    available: row.available,
    rating: shown.rating,
    verified: row.verified,
    status: row.status,
    ...flags(row, shown),
    createdAt: row.createdAt.toISOString(),
  }
}

/** A portfolio picture: the item's id and caption, the file's address and size. */
export function toPortfolioItem(
  row: PortfolioRow,
  media: Media
): Mechanic["portfolio"][number] {
  return {
    id: row.id,
    url: media.url,
    caption: row.caption,
    width: media.width,
    height: media.height,
    placeholderColor: media.placeholderColor,
  }
}
