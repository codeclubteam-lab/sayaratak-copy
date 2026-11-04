import { type Executor, type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"

import * as admin from "./reviews.admin.queries"
import { type ReviewRow, toReview } from "./reviews.mapper"
import * as q from "./reviews.queries"

const PAGE_SIZE = { default: 20, max: 100 }

/** Raw query values of `GET /admin/reviews`, read as the mock reads them. */
export type ReviewsQuery = Partial<
  Record<
    | "id"
    | "status"
    | "targetType"
    | "rating"
    | "q"
    | "page"
    | "pageSize"
    | "limit",
    string
  >
>

/**
 * One page of reviews, newest first. `q` matches the author, the text and
 * the business name; the business ids that match by name come from the
 * caller, since the business tables are not this module's.
 */
export async function listAdminReviews(
  ex: Executor,
  query: ReviewsQuery,
  namedTargetIds: string[]
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const term = query.q?.trim().toLowerCase()
  const found = await admin.listForAdmin(ex, {
    id: query.id || undefined,
    status: query.status || undefined,
    targetType: query.targetType || undefined,
    rating: query.rating ? Number(query.rating) : undefined,
    search: term ? { term, targetIds: namedTargetIds } : undefined,
    page: { offset: (page - 1) * size, size },
  })
  return {
    reviews: found.rows.map(toReview),
    total: found.total,
    page,
    pageSize: size,
  }
}

/**
 * `POST /admin/reviews/:id/hide|show`: a hidden review leaves the public
 * list and the rating; showing puts it back (and clears a flag). The same
 * state again changes nothing and writes no audit row. 404 for an unknown review.
 */
export async function setReviewStatus(
  tx: Transaction,
  actor: Actor,
  change: { id: string; status: "visible" | "hidden" }
) {
  const locked = await admin.lockReview(tx, change.id)
  if (!locked) fail.notFound()
  if (locked.status === change.status) return toReview(locked)
  const saved = await q.update(tx, change.id, { status: change.status })
  await recordAudit(tx, actor, {
    action: change.status === "hidden" ? "review.hide" : "review.show",
    targetType: "review",
    targetId: change.id,
    before: { status: locked.status },
    after: { status: change.status },
  })
  return toReview(saved ?? locked)
}

/** `DELETE /reviews/:id` by an admin on another person's review: the review is gone and an audit row says who. */
export function deleteReviewAsAdmin(actor: Actor, row: ReviewRow) {
  return transaction(async (tx) => {
    await q.remove(tx, row.id)
    await recordAudit(tx, actor, {
      action: "review.delete",
      targetType: "review",
      targetId: row.id,
      before: {
        status: row.status,
        rating: row.rating,
        targetId: row.targetId,
      },
    })
  })
}
