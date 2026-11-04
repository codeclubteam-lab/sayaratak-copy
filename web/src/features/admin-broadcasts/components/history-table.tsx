import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { MegaphoneIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import type { AdminTableSearch } from "@/features/admin/schemas"
import { EmptyState } from "@/components/app/empty-state"
import { HistoryCard } from "./history-card"
import { useHistoryColumns } from "./use-history-columns"

const POLL_MS = 2000

// Sent broadcasts, newest first. Search by title and page live in the URL; turning a page adds a history entry.
export function HistoryTable({
  search,
  go,
}: {
  search: AdminTableSearch
  go: (next: AdminTableSearch, push?: boolean) => void
}) {
  const { t } = useT()
  const { q, page } = search
  const list = useQuery({
    ...adminQueries.broadcasts({ q, page }),
    // The server rings the bells in the background: follow the list until every row is sent.
    refetchInterval: (query) =>
      query.state.data?.items.some((b) => b.status !== "sent")
        ? POLL_MS
        : false,
  })
  const columns = useHistoryColumns()
  const onNavigate = useCallback(
    (next: AdminTableSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  return (
    <AdminTable
      label={t("admin.broadcast_history")}
      columns={columns}
      getRowId={(b) => b.id}
      loading={list.isPending}
      error={list.isError}
      onRetry={() => void list.refetch()}
      search={search}
      onNavigate={onNavigate}
      result={list.data}
      mobileCard={(b) => <HistoryCard broadcast={b} />}
      empty={
        <EmptyState
          icon={MegaphoneIcon}
          title={t(
            q ? "admin.broadcast_empty_filtered" : "admin.broadcast_empty"
          )}
        />
      }
    />
  )
}
