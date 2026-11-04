import { type SQL, sql } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"

import type { Executor } from "~/shared/db/tx"

/**
 * Deletes up to `size` rows of `table` that match `where`, one statement, and answers how many.
 * The rows are taken by their physical address (`ctid`) so it works for a table without a single
 * key, and `skip locked` leaves rows another transaction holds for the next run. The cleanup jobs
 * (A10) loop over it until a batch comes back short.
 */
export async function deleteBatch(
  ex: Executor,
  target: { table: PgTable; where: SQL },
  size: number
) {
  // `returning 1` only so the statement answers one row per deleted row.
  const rows = await ex.execute(
    sql`delete from ${target.table} where ctid in (select ctid from ${target.table} where ${target.where} limit ${size} for update skip locked) returning 1`
  )
  return rows.length
}
