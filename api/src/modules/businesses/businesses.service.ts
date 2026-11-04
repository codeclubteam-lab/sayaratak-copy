import type { MapPoint } from "@sayaratak/shared/schemas/responses"

import type { Executor } from "~/shared/db/tx"
import { type Box, inBox } from "~/shared/geo/box"
import * as auth from "~/modules/auth/auth.service"
import * as reviews from "~/modules/reviews/reviews.service"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import { toMapPoint } from "./businesses.mapper"
import * as q from "./businesses.queries"

export type BusinessLayer = "dealerships" | "workshops" | "mechanics"

/** The id of the dealership, workshop or mechanic profile the user owns, if any. */
export function getBusinessIdOf(ex: Executor, ownerUserId: string) {
  return q.getIdOfOwner(ex, ownerUserId)
}

/** Whether the id names a dealership, workshop or mechanic profile. */
export function hasBusiness(ex: Executor, id: string) {
  return q.hasBusiness(ex, id)
}

/** The dealership the user owns, if any. */
export function getDealershipOf(ex: Executor, ownerUserId: string) {
  return q.getDealershipOf(ex, ownerUserId)
}

/** The dealerships of these owners, keyed by owner id. */
export async function getDealershipsOf(ex: Executor, ownerUserIds: string[]) {
  const rows = await q.listDealershipsOf(ex, ownerUserIds)
  return new Map(rows.map((row) => [row.ownerUserId, row]))
}

/** Owners whose business is suspended; their listings leave the public site. */
export function listSuspendedOwnerIds(ex: Executor) {
  return q.listSuspendedOwnerIds(ex)
}

/** Owners of a verified dealership: its listings show it as verified. */
export function listVerifiedDealershipOwnerIds(ex: Executor) {
  return q.listVerifiedDealershipOwnerIds(ex)
}

/**
 * Listed businesses of the asked layers inside the box, as map points:
 * dealerships, then workshops, then mechanics, each in mock order. Mechanics
 * have no pin of their own, so they sit at the center of their city.
 */
export async function listMapPoints(
  ex: Executor,
  map: { layers: Set<BusinessLayer>; box: Box }
): Promise<MapPoint[]> {
  const hiddenOwnerIds = await auth.listBannedIds(ex)
  const find = { ...map, hiddenOwnerIds }
  // Independent reads.
  const [dealers, shops, people] = await Promise.all([
    findPinned(ex, find, "dealership"),
    findPinned(ex, find, "workshop"),
    findMechanics(ex, find),
  ])
  const all = [...dealers, ...shops, ...people]
  const [ratings, photos] = await Promise.all([
    reviews.getRatingsOf(
      ex,
      all.map((b) => b.id)
    ),
    uploads.getMediaOf(
      ex,
      all.flatMap((b) => (b.photoId ? [b.photoId] : []))
    ),
  ])
  return all.map((b) =>
    toMapPoint({
      ...b,
      rating: ratings.get(b.id),
      photoUrl: b.photoId ? photos.get(b.photoId)?.url : undefined,
    })
  )
}

type Find = { layers: Set<BusinessLayer>; box: Box; hiddenOwnerIds: string[] }

async function findPinned(
  ex: Executor,
  find: Find,
  kind: "dealership" | "workshop"
) {
  if (!find.layers.has(`${kind}s`)) return []
  const rows = await q.listPinnedInBox(ex, { ...find, kind })
  return rows.flatMap(({ lat, lng, ...row }) =>
    lat === null || lng === null
      ? []
      : [{ ...row, kind, location: { lat, lng } }]
  )
}

// Filtered by city center here: the centers are taxonomy rows, and mechanics
// number a few hundred at most.
async function findMechanics(ex: Executor, find: Find) {
  if (!find.layers.has("mechanics")) return []
  const [rows, centers] = await Promise.all([
    q.listListedMechanics(ex, find.hiddenOwnerIds),
    taxonomy.getCityCenters(ex),
  ])
  return rows.flatMap(({ cityId, ...row }) => {
    const location = centers.get(cityId)
    return location && inBox(find.box, location)
      ? [{ ...row, kind: "mechanic" as const, location }]
      : []
  })
}
