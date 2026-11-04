import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router"
import { MessageSquareIcon, StarIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { RatingSummary } from "@/components/app/rating-summary"
import { resultsHeadingId } from "@/components/app/results-header"
import { ResultsPagination } from "@/components/app/results-pagination"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { businessQueries } from "@/features/directory/queries"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { TargetType } from "@sayaratak/shared/schemas/review"
import { reviewQueries } from "../queries"
import {
  pruneReviewsSearch,
  reviewsSearchSchema,
  type ReviewsSearch,
} from "../schemas"
import { ManagerReviewItem } from "./manager-review-item"

const PAGE_SIZE = 10

// The owner's reviews: summary of the rating, filter All | Needs reply, the list with reply and report controls, numbered pages. The filter and page live in the URL.
export function ReviewsManagerPage({ targetType }: { targetType: TargetType }) {
  const { t, locale } = useT()
  const search = reviewsSearchSchema.parse(useSearch({ strict: false }))
  const pathname = useLocation({ select: (l) => l.pathname })
  const navigate = useNavigate()
  const title = t("dashboard.nav_reviews")
  usePageTitle(title)
  const { filter, page } = search
  const business = useQuery(businessQueries.mine)
  const targetId = business.data?.id ?? ""
  const list = useQuery({
    ...reviewQueries.list(targetType, targetId, {
      page,
      pageSize: PAGE_SIZE,
      includeHidden: true,
      needsReply: filter === "needs_reply" || undefined,
    }),
    enabled: !!targetId,
  })
  const go = (next: Partial<ReviewsSearch>, replace: boolean) =>
    void navigate({
      to: ".",
      search: pruneReviewsSearch({ ...search, ...next }),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  const hrefFor = (p: number) => {
    const query = new URLSearchParams(
      Object.entries(pruneReviewsSearch({ ...search, page: p })).map(
        ([k, v]) => [k, String(v)]
      )
    ).toString()
    return localeHref(`${pathname}${query && `?${query}`}`, locale)
  }
  const failed = business.isError || (list.isError && !list.data)
  const rating = business.data?.rating
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={
          list.data && filter === "all"
            ? formatNumber(list.data.total, locale)
            : undefined
        }
        headingId={resultsHeadingId}
      />
      {rating && (
        <RatingSummary
          avg={rating.avg}
          count={rating.count}
          histogram={rating.distribution}
        />
      )}
      <ToggleGroup
        aria-label={t("reviews_manager.filter_label")}
        variant="outline"
        spacing={0}
        value={[filter]}
        onValueChange={(next) =>
          go(
            {
              filter: next[0] === "needs_reply" ? "needs_reply" : "all",
              page: 1,
            },
            true
          )
        }
      >
        <ToggleGroupItem value="all">
          {t("reviews_manager.filter_all")}
        </ToggleGroupItem>
        <ToggleGroupItem value="needs_reply">
          {t("reviews_manager.filter_needs_reply")}
        </ToggleGroupItem>
      </ToggleGroup>
      {failed ? (
        <SectionError
          message={t("reviews.load_error")}
          onRetry={() => void (business.isError ? business : list).refetch()}
        />
      ) : !list.data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={filter === "all" ? StarIcon : MessageSquareIcon}
          title={t(
            filter === "all"
              ? "reviews_manager.empty_title"
              : "reviews_manager.empty_needs_reply_title"
          )}
          body={t(
            filter === "all"
              ? "reviews_manager.empty_body"
              : "reviews_manager.empty_needs_reply_body"
          )}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-card px-4">
          {list.data.items.map((review) => (
            <ManagerReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
      <ResultsPagination
        page={page}
        pageCount={Math.ceil((list.data?.total ?? 0) / PAGE_SIZE)}
        hrefFor={hrefFor}
        onPageChange={(p) => go({ page: p }, false)}
      />
    </div>
  )
}
