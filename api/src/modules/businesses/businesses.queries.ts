import { and, asc, between, eq, inArray, notInArray, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import type { Box } from "~/shared/geo/box"

import { dealerships, mechanics, workshops } from "./businesses.tables"
import type { BusinessKind } from "./businesses.types"

/** The kind and id of the one business profile the user owns, of any kind. */
export async function getRefOfOwner(ex: Executor, ownerUserId: string) {
  const tables = [
    ["dealership", dealerships],
    ["workshop", workshops],
    ["mechanic", mechanics],
  ] as const
  // One account has one business, so at most one of the three answers.
  const found = await Promise.all(
    tables.map(([kind, table]) =>
      ex
        .select({ id: table.id })
        .from(table)
        .where(eq(table.ownerUserId, ownerUserId))
        .then(([row]) => (row ? { kind, id: row.id } : undefined))
    )
  )
  return found.find(Boolean)
}

/** The id of the one business profile the user owns, of any kind. */
export async function getIdOfOwner(ex: Executor, ownerUserId: string) {
  return (await getRefOfOwner(ex, ownerUserId))?.id
}

/**
 * The upload ids a business shows as pictures, keyed by the profile's address
 * field: `logoUrl` and `coverUrl`, or a mechanic's `photoUrl`. Empty is null.
 */
export async function getPictureIds(
  ex: Executor,
  ref: { kind: BusinessKind; id: string }
): Promise<Record<string, string | null>> {
  if (ref.kind === "mechanic") {
    const [row] = await ex
      .select({ photoUrl: mechanics.photoUploadId })
      .from(mechanics)
      .where(eq(mechanics.id, ref.id))
    return { photoUrl: row?.photoUrl ?? null }
  }
  const table = ref.kind === "dealership" ? dealerships : workshops
  const [row] = await ex
    .select({ logoUrl: table.logoUploadId, coverUrl: table.coverUploadId })
    .from(table)
    .where(eq(table.id, ref.id))
  return { logoUrl: row?.logoUrl ?? null, coverUrl: row?.coverUrl ?? null }
}

/** The kind and owner account of the profile with this id; ids are unique across the three kinds. */
export async function getOwnerOf(ex: Executor, id: string) {
  const tables = [
    ["dealership", dealerships],
    ["workshop", workshops],
    ["mechanic", mechanics],
  ] as const
  const found = await Promise.all(
    tables.map(([kind, table]) =>
      ex
        .select({ ownerUserId: table.ownerUserId })
        .from(table)
        .where(eq(table.id, id))
        .limit(1)
        .then(([row]) =>
          row ? { kind, ownerUserId: row.ownerUserId } : undefined
        )
    )
  )
  return found.find(Boolean)
}

/** Whether a dealership, workshop or mechanic profile has this id. */
export async function hasBusiness(ex: Executor, id: string) {
  const found = await Promise.all(
    [dealerships, workshops, mechanics].map((table) =>
      ex
        .select({ id: table.id })
        .from(table)
        .where(eq(table.id, id))
        .limit(1)
        .then((rows) => rows.length > 0)
    )
  )
  return found.some(Boolean)
}

export function getDealershipOf(ex: Executor, ownerUserId: string) {
  return ex
    .select()
    .from(dealerships)
    .where(eq(dealerships.ownerUserId, ownerUserId))
    .then(([row]) => row)
}

export function listDealershipsOf(ex: Executor, ownerUserIds: string[]) {
  if (ownerUserIds.length === 0) return Promise.resolve([])
  return ex
    .select()
    .from(dealerships)
    .where(inArray(dealerships.ownerUserId, ownerUserIds))
}

/** Owners of a suspended dealership, workshop or mechanic profile. */
export async function listSuspendedOwnerIds(ex: Executor) {
  const lists = await Promise.all(
    [dealerships, workshops, mechanics].map((table) =>
      ex
        .select({ id: table.ownerUserId })
        .from(table)
        .where(eq(table.status, "suspended"))
    )
  )
  return lists.flat().map((row) => row.id)
}

export function listVerifiedDealershipOwnerIds(ex: Executor) {
  return ex
    .select({ id: dealerships.ownerUserId })
    .from(dealerships)
    .where(eq(dealerships.verified, true))
    .then((rows) => rows.map((row) => row.id))
}

// The mock's array order: seeded ids (`d-1` to `d-12`) by number, then newer
// ones (`d-` and 8 characters). Example: d-2 before d-10 before d-k3x9q2ab.
export const byIdNumber = (
  table: typeof dealerships | typeof workshops | typeof mechanics
) => [asc(sql`length(${table.id})`), asc(table.id)]

// Active, and the owner not in `hiddenOwnerIds` (mock `listed`).
export function listedWhere(
  table: typeof dealerships | typeof workshops | typeof mechanics,
  hiddenOwnerIds: string[]
) {
  return and(
    eq(table.status, "active"),
    hiddenOwnerIds.length > 0
      ? notInArray(table.ownerUserId, hiddenOwnerIds)
      : undefined
  )
}

/** Listed dealerships or workshops with a pin inside the box, in mock order. */
export function listPinnedInBox(
  ex: Executor,
  find: {
    kind: "dealership" | "workshop"
    box: Box
    hiddenOwnerIds: string[]
  }
) {
  const { box } = find
  const table = find.kind === "dealership" ? dealerships : workshops
  return ex
    .select({
      id: table.id,
      slug: table.slug,
      name: table.name,
      lat: table.lat,
      lng: table.lng,
      photoId: table.logoUploadId,
    })
    .from(table)
    .where(
      and(
        listedWhere(table, find.hiddenOwnerIds),
        between(table.lat, box.south, box.north),
        between(table.lng, box.west, box.east)
      )
    )
    .orderBy(...byIdNumber(table))
}

/** Listed mechanics, in mock order. */
export function listListedMechanics(ex: Executor, hiddenOwnerIds: string[]) {
  return ex
    .select({
      id: mechanics.id,
      slug: mechanics.slug,
      name: mechanics.name,
      cityId: mechanics.cityId,
      photoId: mechanics.photoUploadId,
    })
    .from(mechanics)
    .where(listedWhere(mechanics, hiddenOwnerIds))
    .orderBy(...byIdNumber(mechanics))
}
