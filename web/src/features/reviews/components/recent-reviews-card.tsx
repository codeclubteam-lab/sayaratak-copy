import { useId } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { StarIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { ReviewItem } from "@/components/app/review-item"
import { SectionError } from "@/components/app/section-error"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { businessQueries } from "@/features/directory/queries"
import { useT } from "@/lib/i18n/use-t"
import { reviewQueries } from "../queries"
import { ReplyBlock } from "./reply-block"

const SHOWN = 3
const reviewsPage = {
  workshop: "/$locale/workshop/reviews",
  mechanic: "/$locale/mechanic/reviews",
} as const

// The three newest public reviews of the owner's workshop or mechanic profile, each with the 8.6 reply controls in place. The reviews page has the rest.
export function RecentReviewsCard({
  targetType,
}: {
  targetType: "workshop" | "mechanic"
}) {
  const { t, locale } = useT()
  const id = useId()
  const business = useQuery(businessQueries.mine)
  const targetId = business.data?.id ?? ""
  const list = useQuery({
    ...reviewQueries.list(targetType, targetId, { pageSize: SHOWN }),
    enabled: !!targetId,
  })
  const failed = business.isError || (list.isError && !list.data)
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 rounded-xl bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-body font-semibold">
          {t("dashboard.recent_reviews_title")}
        </h2>
        <Link
          to={reviewsPage[targetType]}
          params={{ locale }}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("common.see_all")}
        </Link>
      </div>
      {failed ? (
        <SectionError
          message={t("reviews.load_error")}
          onRetry={() => void (business.isError ? business : list).refetch()}
        />
      ) : !list.data ? (
        <Skeleton className="h-48" aria-hidden="true" />
      ) : !list.data.items.length ? (
        <EmptyState
          icon={StarIcon}
          title={t("reviews_manager.empty_title")}
          level={3}
          className="py-6"
        />
      ) : (
        <ul className="divide-y divide-border">
          {list.data.items.slice(0, SHOWN).map((review) => (
            <ReviewItem key={review.id} review={review}>
              <ReplyBlock review={review} />
            </ReviewItem>
          ))}
        </ul>
      )}
    </section>
  )
}
