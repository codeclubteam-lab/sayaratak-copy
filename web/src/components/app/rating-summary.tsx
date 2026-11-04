import { StarIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { RatingStars } from "./rating-stars"

// Without `histogram` it is the one-line form for cards and profile headers.
// `histogram[0]` counts the 1-star reviews and `histogram[4]` the 5-star ones.
export function RatingSummary({
  avg,
  count,
  histogram,
}: {
  avg: number
  count: number
  histogram?: number[]
}) {
  const { t, locale } = useT()
  if (count === 0)
    return (
      <span className="text-caption text-muted-foreground">
        {t("directory.no_reviews")}
      </span>
    )
  if (!histogram)
    return (
      <span className="inline-flex items-center gap-1">
        <StarIcon
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-4 fill-foreground"
        />
        <span className="text-ui font-medium num">{avg.toFixed(1)}</span>
        <span className="text-caption text-muted-foreground">
          {t("directory.reviews_count", { count })}
        </span>
      </span>
    )
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="flex flex-col gap-1">
        <span className="text-hero font-semibold num">{avg.toFixed(1)}</span>
        <RatingStars value={avg} />
        <span className="text-caption text-muted-foreground">
          {t("directory.reviews_count", { count })}
        </span>
      </div>
      <ul className="flex min-w-48 flex-1 flex-col gap-1">
        {[5, 4, 3, 2, 1].map((stars) => {
          const n = histogram[stars - 1] ?? 0
          return (
            <li key={stars}>
              <div
                role="img"
                aria-label={t("directory.histogram_row", {
                  count: stars,
                  reviews: n,
                })}
                className="flex items-center gap-2 text-caption"
              >
                <span aria-hidden="true" className="w-3 text-center num">
                  {stars}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(n / count) * 100}%` }}
                  />
                </span>
                <span
                  aria-hidden="true"
                  className="w-8 text-end text-muted-foreground num"
                >
                  {formatNumber(n, locale)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
