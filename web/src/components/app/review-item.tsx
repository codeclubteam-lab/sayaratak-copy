import type { ReactNode } from "react"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Review } from "@sayaratak/shared/schemas/review"
import { Button } from "@/components/ui/button"
import { RatingStars } from "./rating-stars"

// One review with the owner's reply under it. `onEdit` is set only on the viewer's own review. The owner's manager passes `badge` (a status next to the date) and `children` (its own reply controls, shown in place of the read-only reply).
export function ReviewItem({
  review,
  onEdit,
  badge,
  children,
}: {
  review: Review
  onEdit?: () => void
  badge?: ReactNode
  children?: ReactNode
}) {
  const { t, locale } = useT()
  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-ui font-semibold" dir="auto">
          {review.authorName}
        </span>
        <RatingStars value={review.rating} />
        <time
          dateTime={review.createdAt}
          className="text-caption text-muted-foreground"
        >
          {formatDate(review.createdAt, locale)}
        </time>
        {badge}
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            {t("reviews.edit")}
          </Button>
        )}
      </div>
      {review.body && (
        <p className="text-body whitespace-pre-line" dir="auto">
          {review.body}
        </p>
      )}
      {children ??
        (review.reply && (
          <div className="ms-6 flex flex-col gap-1 rounded-lg bg-muted p-3">
            <span className="text-caption font-semibold">
              {t("reviews.owner_reply")}
            </span>
            <p className="text-ui" dir="auto">
              {review.reply.body}
            </p>
          </div>
        ))}
    </li>
  )
}
