import { SelectInput } from "@/components/app/select-input"
import { useT } from "@/lib/i18n/use-t"
import { formatNumber } from "@/lib/format"
import { targetTypeSchema } from "@sayaratak/shared/schemas/review"
import {
  reviewsSearchSchema,
  type ReviewsSearch,
} from "@/features/admin/schemas"

const ratings = ["5", "4", "3", "2", "1"]

// Business type and star rating selects in the table toolbar. Clearing one drops it from the URL.
export function ReviewFilters({
  search,
  onChange,
}: {
  search: ReviewsSearch
  onChange: (next: Partial<ReviewsSearch>) => void
}) {
  const { t, locale } = useT()
  const { targetType, rating } = reviewsSearchSchema.shape
  return (
    <>
      <SelectInput
        className="w-44"
        aria-label={t("admin.review_target_filter")}
        placeholder={t("admin.review_target_filter")}
        value={search.targetType ?? ""}
        options={targetTypeSchema.options.map((v) => ({
          value: v,
          label: t(`dashboard.role_${v}`),
        }))}
        onChange={(next) =>
          onChange({ targetType: targetType.parse(next || undefined) })
        }
      />
      <SelectInput
        className="w-36"
        aria-label={t("admin.review_rating_filter")}
        placeholder={t("admin.review_rating_filter")}
        value={search.rating ? String(search.rating) : ""}
        options={ratings.map((v) => ({
          value: v,
          label: t("admin.review_stars", {
            count: Number(v),
            n: formatNumber(Number(v), locale),
          }),
        }))}
        onChange={(next) =>
          onChange({ rating: rating.parse(next || undefined) })
        }
      />
    </>
  )
}
