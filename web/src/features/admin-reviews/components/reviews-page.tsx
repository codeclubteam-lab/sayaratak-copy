import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { StarIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import {
  reviewTabs,
  reviewsSearchSchema,
  type ReviewsSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReviewCard } from "./review-card"
import { ReviewFilters } from "./review-filters"
import { useReviewColumns } from "./use-review-columns"

// Reviews of businesses, flagged ones first. The URL holds the tab, filters, search and page.
export function ReviewsPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_reviews")
  usePageTitle(title)
  const search = reviewsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { tab, q, page, targetType, rating } = search
  const list = useQuery(
    adminQueries.reviews({ status: tab, q, page, targetType, rating })
  )

  // Turning a page adds a history entry, so Back undoes it; the rest replaces.
  const onNavigate = useCallback(
    (next: ReviewsSearch) =>
      void navigate({
        to: ".",
        search: next,
        replace: next.page === search.page,
        resetScroll: false,
      }),
    [navigate, search.page]
  )
  const columns = useReviewColumns()
  const filtered = q || targetType || rating
  const empty = filtered
    ? { title: t("admin.reviews_empty_search") }
    : {
        title: t(`admin.reviews_empty_${tab}`),
        body: t(`admin.reviews_empty_${tab}_body`),
      }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={
          list.data && tab === "flagged"
            ? formatNumber(list.data.total, locale)
            : undefined
        }
      />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          onNavigate({
            ...search,
            tab: reviewsSearchSchema.shape.tab.parse(next),
            page: 1,
          })
        }
      >
        <TabsList aria-label={t("admin.reviews_tabs")}>
          {reviewTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`admin.reviews_tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          <AdminTable
            label={t("admin.reviews_table")}
            columns={columns}
            getRowId={(r) => r.id}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
            search={search}
            onNavigate={onNavigate}
            result={list.data}
            filters={
              <ReviewFilters
                search={search}
                onChange={(next) => onNavigate({ ...search, ...next, page: 1 })}
              />
            }
            mobileCard={(r) => <ReviewCard review={r} />}
            empty={<EmptyState icon={StarIcon} {...empty} />}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
