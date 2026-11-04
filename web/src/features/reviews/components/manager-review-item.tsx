import { ReviewItem } from "@/components/app/review-item"
import { Badge } from "@/components/ui/badge"
import { useT } from "@/lib/i18n/use-t"
import type { Review } from "@sayaratak/shared/schemas/review"
import { ReplyBlock } from "./reply-block"
import { ReportReviewButton } from "./report-review-button"

// A review as its owner sees it: a label when moderators hid it or the owner reported it, then the reply controls and "Report to moderators".
export function ManagerReviewItem({ review }: { review: Review }) {
  const { t } = useT()
  return (
    <ReviewItem
      review={review}
      badge={
        review.status !== "visible" && (
          <Badge variant={review.status === "hidden" ? "muted" : "warning"}>
            {t(
              review.status === "hidden"
                ? "reviews_manager.hidden"
                : "reviews_manager.reported"
            )}
          </Badge>
        )
      }
    >
      <ReplyBlock review={review}>
        <ReportReviewButton review={review} />
      </ReplyBlock>
    </ReviewItem>
  )
}
