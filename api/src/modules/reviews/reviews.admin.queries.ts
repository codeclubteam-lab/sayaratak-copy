import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import { reviews } from "./reviews.tables"

/** The admin table's filters as the mock reads them; unset means no filter. */
export type AdminReviewFilters = {
  id?: string
  status?: string
  targetType?: string
  /** An exact star count; a number no review can have matches nothing. */
  rating?: number
  /** Lower case text for the author and the text, with the ids of the businesses whose name holds it. */
  search?: { term: string; targetIds: string[] }
  page: { offset: number; size: number }
}

/** One page of reviews with the total, newest first, ties in the mock's id order (`r-2` before `r-10`). */
export async function listForAdmin(ex: Executor, find: AdminReviewFilters) {
  const where = and(
    find.id ? eq(reviews.id, find.id) : undefined,
    textIs(reviews.status, find.status),
    textIs(reviews.targetType, find.targetType),
    ratingIs(find.rating),
    searchWhere(find.search)
  )
  const rows = await ex
    .select({
      review: reviews,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(reviews)
    .where(where)
    .orderBy(
      desc(reviews.createdAt),
      asc(sql`length(${reviews.id})`),
      asc(reviews.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(reviews, where))
  return { rows: rows.map((row) => row.review), total }
}

/** The review, held until the transaction ends: two admins acting on it go one after the other. */
export function lockReview(tx: Transaction, id: string) {
  return tx
    .select()
    .from(reviews)
    .where(eq(reviews.id, id))
    .for("update")
    .then(([row]) => row)
}

// Compared as text: a value outside the enum matches nothing instead of failing the cast.
function textIs(
  column: typeof reviews.status | typeof reviews.targetType,
  value?: string
) {
  return value ? sql`${column}::text = ${value}` : undefined
}

function ratingIs(rating: number | undefined) {
  if (rating === undefined) return undefined
  return Number.isInteger(rating) ? eq(reviews.rating, rating) : sql`false`
}

function searchWhere(search: AdminReviewFilters["search"]) {
  if (!search) return undefined
  return or(
    sql`strpos(lower(${reviews.authorName}), ${search.term}) > 0`,
    sql`strpos(lower(coalesce(${reviews.body}, '')), ${search.term}) > 0`,
    inArray(reviews.targetId, [...search.targetIds, ""])
  )
}
