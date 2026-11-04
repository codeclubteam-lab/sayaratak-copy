import type { ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { SearchXIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { EmptyState } from "@/components/app/empty-state"
import { ResultsPagination } from "@/components/app/results-pagination"
import { ResultsRegion } from "@/components/app/results-region"
import { SectionError } from "@/components/app/section-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const grid = "grid gap-3 md:grid-cols-2 xl:grid-cols-3"

type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

// The body every directory shares: skeletons, error with retry, empty state with "Clear all", then the card grid and numbered pagination.
export function DirectoryResults<T extends { id: string }>({
  list,
  renderItem,
  errorMessage,
  empty,
  onClear,
  onPageChange,
  hrefFor,
}: {
  list: UseQueryResult<Page<T>>
  renderItem: (item: T) => ReactNode
  errorMessage: string
  empty: { title: string; body: string }
  onClear: () => void
  onPageChange: (page: number) => void
  hrefFor: (page: number) => string
}) {
  const { t } = useT()
  const { data } = list
  if (!data)
    return list.isError ? (
      <SectionError
        message={errorMessage}
        onRetry={() => {
          void list.refetch()
        }}
      />
    ) : (
      <div role="status" aria-label={t("common.loading")} className={grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  if (data.total === 0)
    return (
      <EmptyState
        icon={SearchXIcon}
        title={empty.title}
        body={empty.body}
        action={
          <Button type="button" onClick={onClear}>
            {t("common.clear_all")}
          </Button>
        }
      />
    )
  return (
    <>
      <ResultsRegion stale={list.isPlaceholderData}>
        <ul className={grid}>
          {data.items.map((item) => (
            <li key={item.id} className="*:h-full">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      </ResultsRegion>
      <ResultsPagination
        page={data.page}
        pageCount={Math.ceil(data.total / data.pageSize)}
        hrefFor={hrefFor}
        onPageChange={onPageChange}
      />
    </>
  )
}
