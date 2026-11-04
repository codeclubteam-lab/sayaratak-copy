import type { AdminReview } from "@sayaratak/shared/schemas/admin"
import type { Review } from "@sayaratak/shared/schemas/review"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import type { Actor } from "~/modules/audit/audit.types"
import * as businesses from "~/modules/businesses/businesses.admin.service"
import * as reviews from "~/modules/reviews/reviews.admin.service"

/** `GET /admin/reviews`: reviews newest first, each with the business it is about. */
export async function getAdminReviews(query: reviews.ReviewsQuery) {
  const term = query.q?.trim().toLowerCase()
  const namedTargetIds = term
    ? await businesses.listBusinessIdsNamed(db, term)
    : []
  const { reviews: rows, ...page } = await reviews.listAdminReviews(
    db,
    query,
    namedTargetIds
  )
  return { ...page, items: await withTargets(db, rows) }
}

/** `POST /admin/reviews/:id/hide|show`: the review as it is after. */
export function setReviewVisible(
  actor: Actor,
  change: { id: string; visible: boolean }
) {
  return transaction((tx) =>
    reviews.setReviewStatus(tx, actor, {
      id: change.id,
      status: change.visible ? "visible" : "hidden",
    })
  )
}

// Name and slug of each business come from the business modules; a deleted business gives `null`.
async function withTargets(
  ex: Executor,
  rows: Review[]
): Promise<AdminReview[]> {
  const found = await businesses.getAdminBusinessRows(
    ex,
    rows.map((row) => ({ kind: row.targetType, id: row.targetId }))
  )
  const byId = new Map(found.map((row) => [row.id, row]))
  return rows.map((row) => {
    const target = byId.get(row.targetId)
    return {
      ...row,
      target: target ? { name: target.name, slug: target.slug } : null,
    }
  })
}
