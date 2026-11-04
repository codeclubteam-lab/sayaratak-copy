import { and, asc, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { byIdNumber } from "./businesses.queries"
import { dealerships, mechanics, workshops } from "./businesses.tables"
import type { BusinessKind } from "./businesses.types"

const TABLES = {
  dealership: dealerships,
  workshop: workshops,
  mechanic: mechanics,
} as const

/** The admin table's filters as the mock reads them; empty means not set. */
export type AdminFilters = {
  kind: BusinessKind
  id?: string
  cityId?: string
  verified?: boolean
  /** Compared as text: an unknown status matches nothing instead of failing the enum cast. */
  status?: string
  /** Lower case. Matches the name in either language, or an owner in `namedOwnerIds`. */
  q?: string
  namedOwnerIds: string[]
  /** The owners who show a plan: these, or everyone but these. */
  owners?: { in: string[] } | { notIn: string[] }
}

/** Ids and times of the businesses of one kind that match, newest first, ties in the mock's id order. */
export function listRefsForAdmin(ex: Executor, find: AdminFilters) {
  const table = TABLES[find.kind]
  return ex
    .select({ id: table.id, createdAt: table.createdAt })
    .from(table)
    .where(
      and(
        find.id ? eq(table.id, find.id) : undefined,
        find.cityId ? eq(table.cityId, find.cityId) : undefined,
        find.verified === undefined
          ? undefined
          : eq(table.verified, find.verified),
        find.status ? sql`${table.status}::text = ${find.status}` : undefined,
        textWhere(table, find),
        ownersWhere(table, find.owners)
      )
    )
    .orderBy(desc(table.createdAt), ...byIdNumber(table), asc(table.id))
}

/** The business with this id, locked until the transaction ends, so two admins act one after the other. */
export async function lockById(ex: Executor, id: string) {
  for (const kind of Object.keys(TABLES) as BusinessKind[]) {
    const table = TABLES[kind]
    const [row] = await ex
      .select({
        id: table.id,
        name: table.name,
        ownerUserId: table.ownerUserId,
        verified: table.verified,
        status: table.status,
        suspendedReason: table.suspendedReason,
      })
      .from(table)
      .where(eq(table.id, id))
      .for("update")
    if (row) return { kind, row }
  }
  return undefined
}

export function updateFlags(
  ex: Executor,
  change: {
    kind: BusinessKind
    id: string
    set: {
      verified?: boolean
      status?: "active" | "suspended"
      suspendedReason?: string | null
    }
  }
) {
  const table = TABLES[change.kind]
  return ex.update(table).set(change.set).where(eq(table.id, change.id))
}

/** Ids of the businesses of every kind whose name, in either language, holds `term` (lower case). */
export async function listIdsNamed(ex: Executor, term: string) {
  const lists = await Promise.all(
    Object.values(TABLES).map((table) =>
      ex
        .select({ id: table.id })
        .from(table)
        .where(nameHolds(table, term))
        .then((rows) => rows.map((row) => row.id))
    )
  )
  return lists.flat()
}

// Raw SQL: the name is jsonb `{ ar, en }`; the mock searches both joined by a space.
function nameHolds(table: (typeof TABLES)[BusinessKind], term: string) {
  return sql`strpos(lower((${table.name} ->> 'ar') || ' ' || (${table.name} ->> 'en')), ${term}) > 0`
}

function textWhere(table: (typeof TABLES)[BusinessKind], find: AdminFilters) {
  if (!find.q) return undefined
  return or(
    nameHolds(table, find.q),
    find.namedOwnerIds.length > 0
      ? inArray(table.ownerUserId, find.namedOwnerIds)
      : undefined
  )
}

function ownersWhere(
  table: (typeof TABLES)[BusinessKind],
  owners: AdminFilters["owners"]
) {
  if (!owners) return undefined
  if ("in" in owners) return inArray(table.ownerUserId, [...owners.in, ""])
  return owners.notIn.length > 0
    ? notInArray(table.ownerUserId, owners.notIn)
    : undefined
}
