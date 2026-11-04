import { RatingStars } from "@/components/app/rating-stars"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminReview } from "@sayaratak/shared/schemas/admin"
import { ReviewActions } from "./review-actions"
import { ReviewStatusBadge } from "./review-status-badge"
import { ReviewTargetCell } from "./review-target-cell"

// One review below md: the business and the actions, then stars, status, text, author and date.
export function ReviewCard({ review }: { review: AdminReview }) {
  const { locale } = useT()
  const now = useNow()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <ReviewTargetCell review={review} />
        <ReviewActions review={review} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RatingStars value={review.rating} />
        <ReviewStatusBadge status={review.status} />
      </div>
      {review.body && <p className="line-clamp-3 text-body">{review.body}</p>}
      <p className="text-caption text-muted-foreground">
        <bdi>{review.authorName}</bdi>
        {" · "}
        {formatRelative(review.createdAt, now, locale)}
      </p>
    </article>
  )
}
