import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { savedSearchQueries } from "@/features/search/queries"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { SavedSearch } from "@sayaratak/shared/schemas/saved-search"
import { RenameSearchDialog } from "./rename-search-dialog"
import { SavedSearchRow } from "./saved-search-row"

// The searches the person saved from the results page: alerts on or off, new matches, open, rename, delete.
export function SavedSearchesPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_saved_searches")
  usePageTitle(title)
  const list = useQuery(savedSearchQueries.list)
  const [renaming, setRenaming] = useState<SavedSearch>()
  const { data } = list

  let body
  if (!data)
    body = list.isError ? (
      <SectionError
        message={t("dashboard.saved_searches_load_error")}
        onRetry={() => void list.refetch()}
      />
    ) : (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="flex flex-col gap-3"
      >
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  else if (data.length === 0)
    body = (
      <EmptyState
        icon={SearchIcon}
        title={t("dashboard.saved_searches_empty_title")}
        body={t("dashboard.saved_searches_empty_body")}
        action={
          <a href={localeHref("/search", locale)} className={buttonVariants()}>
            {t("dashboard.saved_searches_start")}
          </a>
        }
      />
    )
  else
    body = (
      <>
        <h2 className="sr-only">{t("dashboard.saved_searches_list_title")}</h2>
        <ul className="flex flex-col gap-3">
          {data.map((s) => (
            <SavedSearchRow key={s.id} search={s} onRename={setRenaming} />
          ))}
        </ul>
      </>
    )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={data?.length ? formatNumber(data.length, locale) : undefined}
        hint={t("dashboard.saved_searches_hint")}
      />
      {body}
      <RenameSearchDialog
        search={renaming}
        onClose={() => setRenaming(undefined)}
      />
    </div>
  )
}
