import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { StarIcon } from "lucide-react"

import { useRequireAuth } from "@/features/auth/auth-gate"
import { meQuery } from "@/features/auth/me-query"
import { reviewQueries } from "@/features/reviews/queries"
import { useT } from "@/lib/i18n/use-t"
import type { Rating, TargetType } from "@sayaratak/shared/schemas/review"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "./empty-state"
import { RatingSummary } from "./rating-summary"
import { ReviewForm } from "./review-form"
import { ReviewItem } from "./review-item"

// Summary, list, and the write or edit form. Owners cannot review themselves, so the button is hidden for them.
export function ReviewsSection({
  targetType,
  targetId,
  ownerId,
  rating,
}: {
  targetType: TargetType
  targetId: string
  ownerId: string
  rating: Rating
}) {
  const { t } = useT()
  const requireAuth = useRequireAuth()
  const { data: me } = useQuery(meQuery)
  const [page, setPage] = useState(1)
  const [writing, setWriting] = useState(false)
  const { data, isPending, isError, refetch } = useQuery(
    reviewQueries.list(targetType, targetId, { page })
  )
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    if (!isPending) return
    const timeout = window.setTimeout(() => setDelayed(true), 150)
    return () => window.clearTimeout(timeout)
  }, [isPending])
  const own = me && data?.items.find((r) => r.authorId === me.id)
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1
  const close = () => setWriting(false)
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title font-semibold">{t("reviews.title")}</h2>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <RatingSummary avg={rating.avg} count={rating.count} />
        {me?.id !== ownerId && !writing && !own && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              requireAuth(() => setWriting(true), "auth.reason_review")
            }
          >
            {t("reviews.write")}
          </Button>
        )}
      </div>
      {writing && !own && (
        <ReviewForm
          targetType={targetType}
          targetId={targetId}
          onDone={close}
        />
      )}
      {isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-ui">{t("reviews.load_error")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}
      {isPending && delayed && <Skeleton className="h-24 w-full" />}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={StarIcon}
          title={t("reviews.empty")}
          level={3}
          className="py-6"
        />
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border">
          {data.items.map((r) =>
            writing && r.id === own?.id ? (
              <li key={r.id} className="py-4">
                <ReviewForm
                  targetType={targetType}
                  targetId={targetId}
                  existing={r}
                  onDone={close}
                />
              </li>
            ) : (
              <ReviewItem
                key={r.id}
                review={r}
                onEdit={r.id === own?.id ? () => setWriting(true) : undefined}
              />
            )
          )}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label={t("reviews.title")} className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t("common.previous")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t("common.next")}
          </Button>
        </nav>
      )}
    </section>
  )
}
