import type { Rating } from "@sayaratak/shared/schemas/review"

import { db } from "~/shared/db/client"
import { type Executor, type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { DayRange } from "~/shared/time/khartoum"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.update.service"
import { notify } from "~/modules/notifications/notifications.service"

import { deleteReviewAsAdmin } from "./reviews.admin.service"
import { toReview } from "./reviews.mapper"
import * as q from "./reviews.queries"

const ID_PREFIX = "r"

/** Deletes the reviews of a business that is going away. */
export async function deleteReviewsOf(tx: Transaction, targetId: string) {
  await q.deleteOfTarget(tx, targetId)
}

/** Reviews waiting in the admin flagged queue. */
export function countFlaggedReviews(ex: Executor) {
  return q.countFlagged(ex)
}

/**
 * The average star rating of each target with shown reviews, to one decimal
 * as the mock's `ratingFrom` (4 and 5 stars give 4.5). Targets without one are left out.
 */
export async function getRatingsOf(ex: Executor, targetIds: string[]) {
  const rows = await q.listStarsOf(ex, targetIds)
  return new Map(
    rows.map((row) => [
      row.targetId,
      Math.round((row.stars / row.count) * 10) / 10,
    ])
  )
}

/**
 * The rating each business shows: average to one decimal, review count, and
 * the count per star (the mock's `ratingFrom`). Hidden reviews are left out;
 * a business with none reads `{ avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] }`.
 * Example: one 5 and one 4 give `{ avg: 4.5, count: 2, distribution: [0, 0, 0, 1, 1] }`.
 */
export async function getRatingSummaries(ex: Executor, targetIds: string[]) {
  const rows = await q.listStarCountsOf(ex, targetIds)
  const summaries = new Map<string, Rating>()
  for (const id of targetIds)
    summaries.set(id, { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] })
  const totals = new Map<string, number>()
  for (const row of rows) {
    const summary = summaries.get(row.targetId)
    if (!summary) continue
    summary.count += row.count
    summary.distribution[row.stars - 1] = row.count
    totals.set(
      row.targetId,
      (totals.get(row.targetId) ?? 0) + row.stars * row.count
    )
  }
  for (const [id, summary] of summaries)
    if (summary.count > 0)
      summary.avg =
        Math.round(((totals.get(id) ?? 0) / summary.count) * 10) / 10
  return summaries
}

/** Reviews written about these businesses inside the days (`null`: every business), hidden ones too. */
export function countNewReviews(
  ex: Executor,
  targetIds: string[] | null,
  days: DayRange
) {
  if (targetIds?.length === 0) return Promise.resolve(0)
  return q.countWrittenIn(ex, targetIds, days)
}

type ListInput = Omit<q.ReviewFilter, "withHidden"> & {
  includeHidden: boolean
  page: number
  pageSize: number
}

/**
 * `GET /reviews`: the shown reviews of a business, newest first. Its owner
 * may also ask for hidden ones (`includeHidden`) and for those without a
 * reply (`needsReply`; a hidden review never needs one).
 */
export async function listReviews(
  viewer: SessionUser | null,
  input: ListInput
) {
  const owner = (await businesses.getBusinessOwnerOf(db, input.targetId))
    ?.ownerUserId
  const withHidden = !!viewer && viewer.id === owner && input.includeHidden
  const { rows, total } = await q.listPage(db, { ...input, withHidden })
  return {
    items: rows.map(toReview),
    total,
    page: input.page,
    pageSize: input.pageSize,
  }
}

/**
 * `POST /reviews`: 404 for an unknown business, 403 for its own owner, 409
 * `already_reviewed` for a second review (also two at once, through the
 * unique index). The kind is the business's own, not the one the client says.
 */
export async function createReview(
  user: SessionUser,
  input: { targetId: string; rating: number; body?: string }
) {
  return transaction(async (tx) => {
    const target = await businesses.getBusinessOwnerOf(tx, input.targetId)
    if (!target) fail.notFound()
    if (target.ownerUserId === user.id) fail.forbidden()
    const saved = await q.insert(tx, {
      id: newId(ID_PREFIX),
      targetType: target.kind,
      targetId: input.targetId,
      authorId: user.id,
      authorName: user.name,
      rating: input.rating,
      body: input.body,
      createdAt: clock.now(),
    })
    if (!saved) fail.conflict("already_reviewed")
    await notify(tx, {
      userId: target.ownerUserId,
      type: "review_new",
      title: { ar: "تقييم جديد", en: "New review" },
      body: {
        ar: `حصلت على ${input.rating} نجوم.`,
        en: `You received ${input.rating} stars.`,
      },
      href: "/reviews",
    })
    return toReview(saved)
  })
}

/** `PATCH /reviews/:id`: the author changes the fields sent; status and reply stay. */
export async function editReview(
  user: SessionUser,
  edit: { id: string; change: { rating?: number; body?: string } }
) {
  const row = await q.getById(db, edit.id)
  if (!row) fail.notFound()
  if (row.authorId !== user.id) fail.forbidden()
  const { rating, body } = edit.change
  if (rating === undefined && body === undefined) return toReview(row)
  const saved = await q.update(db, edit.id, { rating, body })
  return toReview(saved ?? row)
}

/** `DELETE /reviews/:id`: its author or an admin; an admin deleting another person's review leaves an audit row. */
export async function deleteReview(
  user: SessionUser,
  change: { id: string; ip: string }
) {
  const row = await q.getById(db, change.id)
  if (!row) fail.notFound()
  if (row.authorId === user.id) return q.remove(db, change.id)
  if (user.role !== "admin") fail.forbidden()
  await deleteReviewAsAdmin({ admin: user, ip: change.ip }, row)
}

/** `POST /reviews/:id/flag`: the business's owner asks the admin to look; the review stays public, and a second flag changes nothing. */
export async function flagReview(user: SessionUser, id: string) {
  const row = await getReviewOfOwner(user, id)
  await q.flagShown(db, id)
  return toReview((await q.getById(db, id)) ?? row)
}

/** `POST /reviews/:id/reply`: the business's owner answers; a new reply replaces the old, a hidden review takes none (409). */
export async function replyToReview(
  user: SessionUser,
  reply: { id: string; body: string }
) {
  const row = await getReviewOfOwner(user, reply.id)
  if (row.status === "hidden") fail.conflict()
  const saved = await q.update(db, reply.id, {
    replyBody: reply.body,
    replyAt: clock.now(),
  })
  return toReview(saved ?? row)
}

// The review, or 404; 403 unless the user owns the business it is about.
async function getReviewOfOwner(user: SessionUser, id: string) {
  const row = await q.getById(db, id)
  if (!row) fail.notFound()
  const target = await businesses.getBusinessOwnerOf(db, row.targetId)
  if (target?.ownerUserId !== user.id) fail.forbidden()
  return row
}
