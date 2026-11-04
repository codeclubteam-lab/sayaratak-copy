import type { DataColumn } from "@/lib/table"
import { RatingStars } from "@/components/app/rating-stars"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminReview } from "@sayaratak/shared/schemas/admin"
import { ReviewActions } from "./review-actions"
import { ReviewStatusBadge } from "./review-status-badge"
import { ReviewTargetCell } from "./review-target-cell"

// Columns of the reviews table. The server keeps them newest first, so no column sorts.
export function useReviewColumns(): DataColumn<AdminReview>[] {
  const { t, locale } = useT()
  const now = useNow()
  return [
    {
      id: "target",
      header: t("admin.review_col_target"),
      enableHiding: false,
      cell: ({ row }) => <ReviewTargetCell review={row.original} />,
    },
    {
      id: "author",
      header: t("admin.review_col_author"),
      cell: ({ row }) => <bdi>{row.original.authorName}</bdi>,
    },
    {
      id: "rating",
      header: t("admin.review_col_rating"),
      cell: ({ row }) => <RatingStars value={row.original.rating} />,
    },
    {
      id: "text",
      header: t("admin.review_col_text"),
      cell: ({ row }) => (
        <p className="line-clamp-2 max-w-80 min-w-48">
          {row.original.body ?? (
            <span className="text-muted-foreground">
              {t("admin.review_no_text")}
            </span>
          )}
        </p>
      ),
    },
    {
      id: "date",
      header: t("admin.report_col_date"),
      cell: ({ row }) => formatRelative(row.original.createdAt, now, locale),
    },
    {
      id: "status",
      header: t("admin.report_col_status"),
      cell: ({ row }) => <ReviewStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: () => (
        <span className="sr-only">{t("admin.review_col_actions")}</span>
      ),
      enableHiding: false,
      cell: ({ row }) => <ReviewActions review={row.original} />,
    },
  ]
}
