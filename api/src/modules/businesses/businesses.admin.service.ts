import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"

import * as q from "./businesses.admin.queries"
import * as owners from "./businesses.owners.queries"
import * as profiles from "./businesses.profile.queries"
import { getOwnerOf } from "./businesses.queries"
import type { BusinessKind } from "./businesses.types"

const PAGE_SIZE = { default: 20, max: 100 }
// The mock lists dealerships, then workshops, then mechanics; the same instant keeps that order.
const KINDS: BusinessKind[] = ["dealership", "workshop", "mechanic"]

/** Raw query values of `GET /admin/businesses`, read as the mock reads them. */
export type BusinessesQuery = Partial<
  Record<
    | "type"
    | "id"
    | "cityId"
    | "verified"
    | "status"
    | "q"
    | "planId"
    | "page"
    | "pageSize"
    | "limit",
    string
  >
>

/** What the admin table shows of one business before the other modules add owner, plan and rating. */
export type AdminBusinessRow = {
  kind: BusinessKind
  id: string
  name: { ar: string; en: string }
  slug: string
  cityId: string
  phone: string
  whatsapp: string | null
  ownerUserId: string
  /** The logo, or a mechanic's photo; null when there is none. */
  imageUploadId: string | null
  verified: boolean
  status: "active" | "suspended"
  suspendedReason: string | null
  createdAt: Date
}

/** The id lists a filter needs from other modules; the route reads each only when asked. */
export type AdminScope = {
  namedOwnerIds: string[]
  /** Per kind: the owners who show the asked plan. */
  owners: Partial<Record<BusinessKind, { in: string[] } | { notIn: string[] }>>
}

/**
 * One page of businesses of all kinds, newest first: `type` picks the kind,
 * `id`, `cityId`, `verified` (yes, anything else means no), `status` and the
 * text search filter it. Paged here because the three kinds live in three tables.
 */
// ponytail: merges the matching ids and times of the three kinds in memory; a SQL union when there are tens of thousands.
export async function listAdminBusinesses(
  ex: Executor,
  query: BusinessesQuery,
  scope: AdminScope
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const lists = await Promise.all(
    KINDS.filter((kind) => !query.type || kind === query.type).map(
      async (kind) =>
        (
          await q.listRefsForAdmin(ex, {
            kind,
            id: query.id || undefined,
            cityId: query.cityId || undefined,
            verified: query.verified ? query.verified === "yes" : undefined,
            status: query.status || undefined,
            q: query.q?.trim().toLowerCase() || undefined,
            namedOwnerIds: scope.namedOwnerIds,
            owners: query.planId ? scope.owners[kind] : undefined,
          })
        ).map((ref) => ({ ...ref, kind }))
    )
  )
  // Stable: the same instant keeps the kind order, then each kind's id order.
  const all = lists
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const refs = all.slice((page - 1) * size, page * size)
  return {
    rows: await getAdminBusinessRows(ex, refs),
    total: all.length,
    page,
    pageSize: size,
  }
}

/** One business as the admin table shows it, or undefined for an unknown id. */
export async function findAdminBusiness(ex: Executor, id: string) {
  const owner = await getOwnerOf(ex, id)
  if (!owner) return undefined
  const [row] = await getAdminBusinessRows(ex, [{ kind: owner.kind, id }])
  return row
}

/** Ids of the businesses, of every kind, whose name holds `term` (lower case): the text search of other admin tables. */
export function listBusinessIdsNamed(ex: Executor, term: string) {
  return q.listIdsNamed(ex, term)
}

/** The business each of these accounts owns, keyed by account id, with its id and name. */
export async function getBusinessesOfOwners(ex: Executor, ownerIds: string[]) {
  const rows = await owners.listOfOwners(ex, ownerIds)
  return new Map(rows.map((row) => [row.ownerUserId, row]))
}

/** Owners of the businesses whose name holds `term` (lower case): the holder search of the subscriptions table. */
export function listOwnerIdsNamed(ex: Executor, term: string) {
  return owners.listOwnerIdsNamed(ex, term)
}

/** The kind and owner of a business, locked until the transaction ends; 404 for an unknown id. */
export async function lockBusinessById(tx: Transaction, id: string) {
  const found = await q.lockById(tx, id)
  if (!found) fail.notFound()
  return {
    kind: found.kind,
    id: found.row.id,
    ownerUserId: found.row.ownerUserId,
  }
}

export async function getAdminBusinessRows(
  ex: Executor,
  refs: { kind: BusinessKind; id: string }[]
): Promise<AdminBusinessRow[]> {
  const idsOf = (kind: BusinessKind) =>
    refs.filter((ref) => ref.kind === kind).map((ref) => ref.id)
  // Independent reads.
  const [dealers, shops, people] = await Promise.all([
    profiles.listDealershipsByIds(ex, idsOf("dealership")),
    profiles.listWorkshopsByIds(ex, idsOf("workshop")),
    profiles.listMechanicsByIds(ex, idsOf("mechanic")),
  ])
  const byId = new Map<string, AdminBusinessRow>()
  for (const row of dealers)
    byId.set(row.id, {
      ...row,
      kind: "dealership",
      phone: row.phones[0] ?? "",
      imageUploadId: row.logoUploadId,
    })
  for (const row of shops)
    byId.set(row.id, {
      ...row,
      kind: "workshop",
      imageUploadId: row.logoUploadId,
    })
  for (const row of people)
    byId.set(row.id, {
      ...row,
      kind: "mechanic",
      imageUploadId: row.photoUploadId,
    })
  return refs.flatMap((ref) => {
    const row = byId.get(ref.id)
    return row ? [row] : []
  })
}
