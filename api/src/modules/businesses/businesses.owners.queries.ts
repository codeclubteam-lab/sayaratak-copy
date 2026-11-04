import { inArray, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { dealerships, mechanics, workshops } from "./businesses.tables"

const TABLES = [dealerships, workshops, mechanics]

/** The business each of these accounts owns (one at most), with its name in both languages. */
export async function listOfOwners(ex: Executor, ownerIds: string[]) {
  if (ownerIds.length === 0) return []
  const lists = await Promise.all(
    TABLES.map((table) =>
      ex
        .select({
          id: table.id,
          ownerUserId: table.ownerUserId,
          name: table.name,
        })
        .from(table)
        .where(inArray(table.ownerUserId, ownerIds))
    )
  )
  return lists.flat()
}

/** Owners of the businesses whose name, in either language, holds `term` (lower case). */
export async function listOwnerIdsNamed(ex: Executor, term: string) {
  const lists = await Promise.all(
    TABLES.map((table) =>
      ex
        .select({ id: table.ownerUserId })
        .from(table)
        .where(
          // Raw SQL: the name is jsonb `{ ar, en }`; the mock searches both joined by a space.
          sql`strpos(lower((${table.name} ->> 'ar') || ' ' || (${table.name} ->> 'en')), ${term}) > 0`
        )
        .then((rows) => rows.map((row) => row.id))
    )
  )
  return lists.flat()
}
