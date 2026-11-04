import type { TargetType } from "@sayaratak/shared/schemas/review"
import { and, count, desc, eq, inArray, isNull, ne, sum } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import { type DayRange, withinDays } from "~/shared/time/khartoum"

import { reviews } from "./reviews.tables"

export type NewReviewRow = typeof reviews.$inferInsert

export function deleteOfTarget(ex: Executor, targetId: string) {
  return ex.delete(reviews).where(eq(reviews.targetId, targetId))
}

export function countFlagged(ex: Executor) {
  return ex.$count(reviews, eq(reviews.status, "flagged"))
}

/** Star totals of the shown (not hidden) reviews of each target. */
export function listStarsOf(ex: Executor, targetIds: string[]) {
  if (targetIds.length === 0) return Promise.resolve([])
  return ex
    .select({
      targetId: reviews.targetId,
      stars: sum(reviews.rating).mapWith(Number),
      count: count(),
    })
    .from(reviews)
    .where(
      and(inArray(reviews.targetId, targetIds), ne(reviews.status, "hidden"))
    )
    .groupBy(reviews.targetId)
}

/** Reviews written inside the days, of these targets; `null` means every target. */
export function countWrittenIn(
  ex: Executor,
  targetIds: string[] | null,
  days: DayRange
) {
  return ex.$count(
    reviews,
    and(
      withinDays(reviews.createdAt, days),
      targetIds ? inArray(reviews.targetId, targetIds) : undefined
    )
  )
}

/** How many shown reviews each target has at each star count. */
export function listStarCountsOf(ex: Executor, targetIds: string[]) {
  if (targetIds.length === 0) return Promise.resolve([])
  return ex
    .select({
      targetId: reviews.targetId,
      stars: reviews.rating,
      count: count(),
    })
    .from(reviews)
    .where(
      and(inArray(reviews.targetId, targetIds), ne(reviews.status, "hidden"))
    )
    .groupBy(reviews.targetId, reviews.rating)
}

export type ReviewFilter = {
  targetType: TargetType
  targetId: string
  withHidden: boolean
  needsReply: boolean
}

/** One page of a business's reviews, newest first, and how many there are in all. */
export async function listPage(
  ex: Executor,
  find: ReviewFilter & { page: number; pageSize: number }
) {
  const where = and(
    eq(reviews.targetType, find.targetType),
    eq(reviews.targetId, find.targetId),
    find.withHidden ? undefined : ne(reviews.status, "hidden"),
    find.needsReply
      ? and(isNull(reviews.replyBody), ne(reviews.status, "hidden"))
      : undefined
  )
  const [rows, total] = await Promise.all([
    ex
      .select()
      .from(reviews)
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(find.pageSize)
      .offset((find.page - 1) * find.pageSize),
    ex.$count(reviews, where),
  ])
  return { rows, total }
}

export async function getById(ex: Executor, id: string) {
  const [row] = await ex.select().from(reviews).where(eq(reviews.id, id))
  return row
}

/** Adds the review; `undefined` when this author already reviewed the business (the unique index). */
export async function insert(ex: Executor, row: NewReviewRow) {
  const [saved] = await ex
    .insert(reviews)
    .values(row)
    .onConflictDoNothing()
    .returning()
  return saved
}

export async function update(
  ex: Executor,
  id: string,
  set: Partial<NewReviewRow>
) {
  const [row] = await ex
    .update(reviews)
    .set(set)
    .where(eq(reviews.id, id))
    .returning()
  return row
}

export function remove(ex: Executor, id: string) {
  return ex.delete(reviews).where(eq(reviews.id, id))
}

/** Marks a shown review as flagged; a hidden or already flagged one stays as it is. */
export function flagShown(ex: Executor, id: string) {
  return ex
    .update(reviews)
    .set({ status: "flagged" })
    .where(and(eq(reviews.id, id), eq(reviews.status, "visible")))
}
