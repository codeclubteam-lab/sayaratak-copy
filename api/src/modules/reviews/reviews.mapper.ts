import type { Review } from "@sayaratak/shared/schemas/review"

import type { reviews } from "./reviews.tables"

export type ReviewRow = typeof reviews.$inferSelect

// A review outlives its deleted author (the column goes null); the shared schema wants an id, so this one stands in.
const DELETED_AUTHOR = "deleted"

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    authorId: row.authorId ?? DELETED_AUTHOR,
    authorName: row.authorName,
    rating: row.rating,
    body: row.body ?? undefined,
    createdAt: row.createdAt.toISOString(),
    reply:
      row.replyBody && row.replyAt
        ? { body: row.replyBody, createdAt: row.replyAt.toISOString() }
        : undefined,
    status: row.status,
  }
}
