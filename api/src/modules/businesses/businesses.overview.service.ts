import type { Bilingual } from "@sayaratak/shared/schemas/fields"

import type { Executor } from "~/shared/db/tx"
import { containing } from "~/shared/text/like"

import * as q from "./businesses.overview.queries"
import type { BusinessKind } from "./businesses.types"

const KINDS: BusinessKind[] = ["dealership", "workshop", "mechanic"]

type Joined = {
  id: string
  kind: BusinessKind
  name: Bilingual
  createdAt: Date
}

/** How many dealerships, workshops and mechanics exist, in any state. */
export async function countBusinesses(ex: Executor) {
  // Three independent reads.
  const [dealerships, workshops, mechanics] = await Promise.all([
    q.count(ex, "dealership"),
    q.count(ex, "workshop"),
    q.count(ex, "mechanic"),
  ])
  return { dealerships, workshops, mechanics }
}

/**
 * The newest profiles of all three kinds, newest first. On the same instant
 * dealerships come before workshops before mechanics, as in the mock.
 */
export async function listNewestJoined(
  ex: Executor,
  limit: number
): Promise<Joined[]> {
  const perKind = await Promise.all(
    KINDS.map(async (kind) =>
      (await q.listNewest(ex, { kind, limit })).map((row) => ({ ...row, kind }))
    )
  )
  return perKind
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}

/** Up to `limit` profiles whose name holds `term`: dealerships first, then workshops, then mechanics. */
export async function searchBusinesses(
  ex: Executor,
  find: { term: string; limit: number }
) {
  const pattern = containing(find.term)
  const perKind = await Promise.all(
    KINDS.map(async (kind) =>
      (await q.search(ex, { kind, pattern, limit: find.limit })).map((row) => ({
        ...row,
        kind,
      }))
    )
  )
  return perKind.flat().slice(0, find.limit)
}

/** A profile is based in this city (a mechanic also counts the cities it serves): the check before an admin deletes it. */
export function hasBusinessInCity(ex: Executor, cityId: string) {
  return q.hasBusinessInCity(ex, cityId)
}

/** A dealership or workshop has this district: the check before an admin deletes it. */
export function hasBusinessInDistrict(ex: Executor, districtId: string) {
  return q.hasBusinessInDistrict(ex, districtId)
}

/** Each profile owner's city and verified badge, keyed by the owner's account id; `ownerIds` limits it to those owners. */
export async function getOwnerProfiles(ex: Executor, ownerIds?: string[]) {
  const rows = await q.listOwnerProfiles(ex, ownerIds)
  return new Map(
    rows.map((row) => [
      row.ownerUserId,
      { cityId: row.cityId, verified: row.verified },
    ])
  )
}
