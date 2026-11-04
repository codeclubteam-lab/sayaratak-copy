import type { Media } from "@sayaratak/shared/schemas/listing"
import type {
  Dealership,
  Mechanic,
  Workshop,
} from "@sayaratak/shared/schemas/profile"
import type { Rating } from "@sayaratak/shared/schemas/review"

import type { Executor } from "~/shared/db/tx"
import * as auth from "~/modules/auth/auth.service"
import * as reviews from "~/modules/reviews/reviews.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import {
  toDealership,
  toMechanic,
  toPortfolioItem,
  toWorkshop,
} from "./businesses.profile.mapper"
import * as q from "./businesses.profile.queries"

// What the profile pages gather from other modules for a set of businesses.
type Context = {
  ratings: Map<string, Rating>
  media: Map<string, Media>
  bannedOwnerIds: Set<string>
}

type Owned = { id: string; ownerUserId: string }

const NO_RATING: Rating = { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] }

/**
 * The dealerships with these ids as the public page shows them, in the order
 * of `ids`; unknown ids drop out. `inventory` is the approved-and-available
 * count per owner (from listings). Suspended ones are included: callers
 * decide who may see them (`GET /me/business` shows them to the owner).
 */
export async function getDealerships(
  ex: Executor,
  find: { ids: string[]; inventory: Map<string, number> }
): Promise<Dealership[]> {
  const rows = ordered(find.ids, await q.listDealershipsByIds(ex, find.ids))
  const ctx = await loadContext(
    ex,
    rows,
    rows.flatMap((row) => [row.logoUploadId, row.coverUploadId])
  )
  return rows.map((row) =>
    toDealership(row, {
      ...shownOf(ctx, row),
      logoUrl: urlOf(ctx, row.logoUploadId),
      coverUrl: urlOf(ctx, row.coverUploadId),
      inventoryCount: find.inventory.get(row.ownerUserId) ?? 0,
    })
  )
}

/** The workshops with these ids, with photos and services, in the order of `ids`. */
export async function getWorkshops(
  ex: Executor,
  ids: string[]
): Promise<Workshop[]> {
  const rows = ordered(ids, await q.listWorkshopsByIds(ex, ids))
  const [images, services] = await Promise.all([
    q.listWorkshopImages(ex, ids),
    q.listWorkshopServices(ex, ids),
  ])
  const ctx = await loadContext(ex, rows, [
    ...rows.flatMap((row) => [row.logoUploadId, row.coverUploadId]),
    ...images.map((image) => image.uploadId),
  ])
  const imagesOf = Map.groupBy(images, (image) => image.workshopId)
  const servicesOf = Map.groupBy(services, (service) => service.workshopId)
  return rows.map((row) =>
    toWorkshop(row, {
      ...shownOf(ctx, row),
      logoUrl: urlOf(ctx, row.logoUploadId),
      coverUrl: urlOf(ctx, row.coverUploadId),
      images: (imagesOf.get(row.id) ?? []).flatMap((image) => {
        const media = ctx.media.get(image.uploadId)
        return media ? [media] : []
      }),
      services: servicesOf.get(row.id) ?? [],
    })
  )
}

/** The mechanics with these ids, with served cities, skills and portfolio, in the order of `ids`. */
export async function getMechanics(
  ex: Executor,
  ids: string[]
): Promise<Mechanic[]> {
  const rows = ordered(ids, await q.listMechanicsByIds(ex, ids))
  // Independent reads.
  const [cities, skills, portfolio] = await Promise.all([
    q.listMechanicCities(ex, ids),
    q.listMechanicSpecializations(ex, ids),
    q.listPortfolio(ex, ids),
  ])
  const ctx = await loadContext(ex, rows, [
    ...rows.map((row) => row.photoUploadId),
    ...portfolio.map((item) => item.uploadId),
  ])
  const citiesOf = Map.groupBy(cities, (city) => city.mechanicId)
  const skillsOf = Map.groupBy(skills, (skill) => skill.mechanicId)
  const portfolioOf = Map.groupBy(portfolio, (item) => item.mechanicId)
  return rows.map((row) =>
    toMechanic(row, {
      ...shownOf(ctx, row),
      photoUrl: urlOf(ctx, row.photoUploadId),
      servedCityIds: (citiesOf.get(row.id) ?? []).map((city) => city.cityId),
      specializationIds: (skillsOf.get(row.id) ?? []).map(
        (skill) => skill.specializationId
      ),
      portfolio: (portfolioOf.get(row.id) ?? []).flatMap((item) => {
        const media = ctx.media.get(item.uploadId)
        return media ? [toPortfolioItem(item, media)] : []
      }),
    })
  )
}

async function loadContext(
  ex: Executor,
  rows: Owned[],
  uploadIds: (string | null)[]
): Promise<Context> {
  // Independent reads.
  const [ratings, media, owners] = await Promise.all([
    reviews.getRatingSummaries(
      ex,
      rows.map((row) => row.id)
    ),
    uploads.getMediaOf(
      ex,
      uploadIds.filter((id): id is string => id !== null)
    ),
    auth.listUsers(
      ex,
      rows.map((row) => row.ownerUserId)
    ),
  ])
  const bannedOwnerIds = new Set(
    owners.filter(auth.isBannedNow).map((owner) => owner.id)
  )
  return { ratings, media, bannedOwnerIds }
}

function shownOf(ctx: Context, row: Owned) {
  return {
    rating: ctx.ratings.get(row.id) ?? NO_RATING,
    unavailable: ctx.bannedOwnerIds.has(row.ownerUserId),
  }
}

// A business with no logo or photo shows an empty address, as the mock does.
function urlOf(ctx: Context, uploadId: string | null) {
  return (uploadId ? ctx.media.get(uploadId)?.url : undefined) ?? ""
}

function ordered<T extends { id: string }>(ids: string[], rows: T[]) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}
