import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { MegaphoneIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import type { AdminTableSearch } from "@/features/admin/schemas"
import { EmptyState } from "@/components/app/empty-state"
import { ActivePromotionCard } from "./active-promotion-card"
import { useActivePromotionColumns } from "./use-active-promotion-columns"

// Promotions running now, newest first. Search and page live in the URL; turning a page adds a history entry.
export function ActivePromotionsTable({
  search,
  go,
}: {
  search: AdminTableSearch
  go: (next: AdminTableSearch, push?: boolean) => void
}) {
  const { t } = useT()
  const { q, page } = search
  const list = useQuery(adminQueries.promotions({ status: "active", q, page }))
  const columns = useActivePromotionColumns()
  const onNavigate = useCallback(
    (next: AdminTableSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  return (
    <AdminTable
      label={t("admin.promos_active_table")}
      columns={columns}
      getRowId={(p) => p.id}
      loading={list.isPending}
      error={list.isError}
      onRetry={() => void list.refetch()}
      search={search}
      onNavigate={onNavigate}
      result={list.data}
      mobileCard={(p) => <ActivePromotionCard promotion={p} />}
      empty={
        <EmptyState
          icon={MegaphoneIcon}
          title={t(q ? "admin.promos_empty_filtered" : "admin.promos_empty")}
        />
      }
    />
  )
}
