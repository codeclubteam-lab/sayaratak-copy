import { inArray } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { dealerships, mechanics, workshops } from "./businesses.tables"

/** The owner, name and page slug of the businesses with these ids, of any kind. */
export async function listSubjectRows(ex: Executor, ids: string[]) {
  if (ids.length === 0) return []
  const tables = [
    ["dealership", dealerships],
    ["workshop", workshops],
    ["mechanic", mechanics],
  ] as const
  const found = await Promise.all(
    tables.map(([kind, table]) =>
      ex
        .select({
          id: table.id,
          slug: table.slug,
          ownerUserId: table.ownerUserId,
          name: table.name,
        })
        .from(table)
        .where(inArray(table.id, ids))
        .then((rows) => rows.map((row) => ({ ...row, kind })))
    )
  )
  return found.flat()
}
