import { asc, desc, ilike, or, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import { broadcasts } from "./notifications.tables"

export type NewBroadcastRow = typeof broadcasts.$inferInsert

/**
 * One page of sent announcements, newest first (ties in the mock's id order: `bc-2` before
 * `bc-10`), with the total. `pattern` keeps those whose title holds it in either language.
 */
export async function listBroadcasts(
  ex: Executor,
  find: { pattern?: string; page: { offset: number; size: number } }
) {
  const where = find.pattern
    ? or(
        ilike(sql`${broadcasts.title} ->> 'ar'`, find.pattern),
        ilike(sql`${broadcasts.title} ->> 'en'`, find.pattern)
      )
    : undefined
  const rows = await ex
    .select({
      broadcast: broadcasts,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(broadcasts)
    .where(where)
    .orderBy(
      desc(broadcasts.createdAt),
      asc(sql`length(${broadcasts.id})`),
      asc(broadcasts.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(broadcasts, where))
  return { rows: rows.map((row) => row.broadcast), total }
}

export function insertBroadcast(tx: Transaction, row: NewBroadcastRow) {
  return tx
    .insert(broadcasts)
    .values(row)
    .returning()
    .then(([saved]) => saved)
}
