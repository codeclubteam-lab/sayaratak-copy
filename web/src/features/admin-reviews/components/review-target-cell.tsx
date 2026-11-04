import { useT } from "@/lib/i18n/use-t"
import type { AdminReview } from "@sayaratak/shared/schemas/admin"

// The business the review is about, and what kind of business it is.
export function ReviewTargetCell({ review }: { review: AdminReview }) {
  const { t, locale } = useT()
  return (
    <div className="flex max-w-60 min-w-0 flex-col">
      <span className="truncate text-ui font-medium">
        <bdi>
          {review.target?.name[locale] ?? t("admin.review_target_gone")}
        </bdi>
      </span>
      <span className="text-caption text-muted-foreground">
        {t(`dashboard.role_${review.targetType}`)}
      </span>
    </div>
  )
}
