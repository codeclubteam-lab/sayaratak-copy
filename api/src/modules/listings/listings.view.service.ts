import type { Listing } from "@sayaratak/shared/schemas/listing"

import type { Executor } from "~/shared/db/tx"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as promotions from "~/modules/promotions/promotions.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import { type ListingParts, toListing } from "./listings.mapper"
import * as q from "./listings.queries"

// A11: everyone except the owner and admins sees the map pin rounded to 2
// decimals (about 1 km), so a private seller's exact spot stays private.
const ROUND_FACTOR = 100
const NO_STATS = { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 }

type Loaded = Awaited<ReturnType<typeof loadParts>>
export type ListingRow = NonNullable<Awaited<ReturnType<typeof q.getListing>>>

/** The listings as `listingSchema` for this viewer, in the order given. */
export async function toListings(
  ex: Executor,
  rows: ListingRow[],
  viewer: SessionUser | null
): Promise<Listing[]> {
  const loaded = await loadParts(ex, rows)
  return rows.map((row) =>
    toListing({
      row,
      stats: loaded.stats.get(row.id) ?? NO_STATS,
      media: mediaOf(row.id, loaded),
      promotions: loaded.running.get(row.id) ?? [],
      owner: ownerOf(row, loaded),
      location: locationFor(row, viewer),
    })
  )
}

/** One listing as `listingSchema` for this viewer. */
export async function toOneListing(
  ex: Executor,
  row: ListingRow,
  viewer: SessionUser | null
) {
  const [listing] = await toListings(ex, [row], viewer)
  if (!listing) throw new Error("toListings dropped a row")
  return listing
}

// Every related list for all the rows at once, so a page of 24 costs a fixed
// number of queries.
async function loadParts(ex: Executor, rows: ListingRow[]) {
  const ids = rows.map((row) => row.id)
  const ownerIds = [
    ...new Set(
      rows.flatMap((row) => (row.ownerUserId ? [row.ownerUserId] : []))
    ),
  ]
  const [stats, mediaRows, running, users, dealers] = await Promise.all([
    q.listStats(ex, ids),
    q.listMediaIds(ex, ids),
    promotions.getRunningOf(ex, ids),
    auth.listUsers(ex, ownerIds),
    businesses.getDealershipsOf(ex, ownerIds),
  ])
  const avatarIds = [
    ...users.flatMap((user) =>
      user.avatarUploadId ? [user.avatarUploadId] : []
    ),
    ...[...dealers.values()].flatMap((d) =>
      d.logoUploadId ? [d.logoUploadId] : []
    ),
  ]
  const media = await uploads.getMediaOf(ex, [
    ...mediaRows.map((row) => row.uploadId),
    ...avatarIds,
  ])
  return {
    stats: new Map(
      stats.map(({ listingId, ...counts }) => [listingId, counts])
    ),
    mediaRows,
    media,
    running,
    users: new Map(users.map((user) => [user.id, user])),
    dealers,
  }
}

function mediaOf(listingId: string, loaded: Loaded) {
  return loaded.mediaRows.flatMap((row) => {
    if (row.listingId !== listingId) return []
    const media = loaded.media.get(row.uploadId)
    return media ? [media] : []
  })
}

// A dealership posts as its business, a person as themselves. The name is the
// one kept on the listing; a deleted owner leaves only that name.
function ownerOf(row: ListingRow, loaded: Loaded): Listing["owner"] {
  const urlOf = (id: string | null) =>
    id ? (loaded.media.get(id)?.url ?? null) : null
  const base = {
    id: row.ownerUserId ?? row.id,
    type: row.ownerType,
    name: row.ownerName,
  }
  const dealer = row.ownerUserId
    ? loaded.dealers.get(row.ownerUserId)
    : undefined
  if (row.ownerType === "dealership" && dealer)
    return {
      ...base,
      avatarUrl: urlOf(dealer.logoUploadId),
      verified: dealer.verified,
      memberSince: dealer.createdAt.toISOString(),
      profileSlug: dealer.slug,
    }
  const user = row.ownerUserId ? loaded.users.get(row.ownerUserId) : undefined
  return {
    ...base,
    avatarUrl: urlOf(user?.avatarUploadId ?? null),
    verified: user?.verifiedPhone ?? false,
    memberSince: (user?.createdAt ?? row.createdAt).toISOString(),
    profileSlug: null,
  }
}

function locationFor(
  row: ListingRow,
  viewer: SessionUser | null
): ListingParts["location"] {
  if (row.lat === null || row.lng === null) return null
  if (viewer && (viewer.id === row.ownerUserId || viewer.role === "admin"))
    return { lat: row.lat, lng: row.lng }
  return { lat: round(row.lat), lng: round(row.lng) }
}

function round(value: number) {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR
}
