import { asc } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { byIdNumber, listedWhere } from "./businesses.queries"
import { dealerships, mechanics, workshops } from "./businesses.tables"

const TABLES = { dealerships, workshops, mechanics }

/** Slugs of the listed profiles of one kind, in the mock's array order. */
export function listListedSlugs(
  ex: Executor,
  find: { kind: keyof typeof TABLES; hiddenOwnerIds: string[] }
) {
  const table = TABLES[find.kind]
  return ex
    .select({ slug: table.slug })
    .from(table)
    .where(listedWhere(table, find.hiddenOwnerIds))
    .orderBy(...byIdNumber(table), asc(table.id))
    .then((rows) => rows.map((row) => row.slug))
}
