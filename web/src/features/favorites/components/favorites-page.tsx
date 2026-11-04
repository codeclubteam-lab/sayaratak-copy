import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router"
import { HeartIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { GridCard } from "@/components/app/page-skeleton"
import { resultsHeadingId } from "@/components/app/results-header"
import { ResultsPagination } from "@/components/app/results-pagination"
import { ResultsRegion } from "@/components/app/results-region"
import { SectionError } from "@/components/app/section-error"
import { Button, buttonVariants } from "@/components/ui/button"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { favoriteQueries } from "@/features/listings/queries"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import {
  favoritesSearchSchema,
  pruneFavoritesSearch,
  type FavoritesSearch,
} from "../schemas"
import { FavoritesGrid } from "./favorites-grid"
import { FavoritesToolbar } from "./favorites-toolbar"

// The saved listings of the signed-in person: type filter, sort, a grid of 24 and numbered pages, all in the URL. Removing one leaves the grid at once and a toast offers Undo.
export function FavoritesPage() {
  const { t, locale } = useT()
  const search = favoritesSearchSchema.parse(useSearch({ strict: false }))
  const pathname = useLocation({ select: (l) => l.pathname })
  const navigate = useNavigate()
  const title = t("dashboard.nav_favorites")
  usePageTitle(title)
  const { type, sort, page } = search
  const list = useQuery(favoriteQueries.list({ type, sort, page }))
  const saved = useQuery(favoriteQueries.ids).data?.length
  const { data } = list

  const go = (next: Partial<FavoritesSearch>, replace: boolean) =>
    void navigate({
      to: ".",
      search: pruneFavoritesSearch({ ...search, ...next }),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  const hrefFor = (p: number) => {
    const query = new URLSearchParams(
      Object.entries(pruneFavoritesSearch({ ...search, page: p })).map(
        ([k, v]) => [k, String(v)]
      )
    ).toString()
    return localeHref(`${pathname}${query && `?${query}`}`, locale)
  }

  // Removing the last card of a page, or a link to a page past the end, lands on the last page.
  const pageCount = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1
  const overshoot = !!data && !list.isPlaceholderData && page > pageCount
  useEffect(() => {
    if (overshoot)
      void navigate({
        to: ".",
        search: pruneFavoritesSearch({ type, sort, page: pageCount }),
        replace: true,
        resetScroll: false,
        viewTransition: false,
      })
  }, [overshoot, navigate, type, sort, pageCount])

  let body
  if (!data)
    body = list.isError ? (
      <SectionError
        message={t("dashboard.favorites_load_error")}
        onRetry={() => void list.refetch()}
      />
    ) : (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <GridCard key={i} />
        ))}
      </div>
    )
  else if (data.total === 0)
    body = type ? (
      <EmptyState
        icon={HeartIcon}
        title={t("dashboard.favorites_empty_type_title")}
        body={t("dashboard.favorites_empty_type_body")}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => go({ type: undefined, page: 1 }, true)}
          >
            {t("dashboard.favorites_show_all")}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={HeartIcon}
        title={t("dashboard.favorites_empty_title")}
        body={t("dashboard.favorites_empty_body")}
        action={
          <a href={localeHref("/search", locale)} className={buttonVariants()}>
            {t("dashboard.favorites_browse")}
          </a>
        }
      />
    )
  else
    body = (
      <>
        <h2 className="sr-only">{t("dashboard.favorites_list_title")}</h2>
        <ResultsRegion stale={list.isPlaceholderData}>
          <FavoritesGrid items={data.items} />
        </ResultsRegion>
        <ResultsPagination
          page={data.page}
          pageCount={pageCount}
          hrefFor={hrefFor}
          onPageChange={(p) => go({ page: p }, false)}
        />
      </>
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        headingId={resultsHeadingId}
        count={saved ? formatNumber(saved, locale) : undefined}
      />
      {!(data?.total === 0 && !type) && (
        <FavoritesToolbar search={search} onChange={(next) => go(next, true)} />
      )}
      {body}
    </div>
  )
}
