import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { ImagesIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import type { AdminTableSearch } from "@/features/admin/schemas"
import type { Banner } from "@sayaratak/shared/schemas/admin"
import { EmptyState } from "@/components/app/empty-state"
import { useBannerColumns } from "./use-banner-columns"

const pageSize = 24

// Banners are few and fetched whole, so search by title and paging happen here. ponytail: move to the mock if the list grows past a few hundred.
export function BannersTable({
  search,
  go,
  onEdit,
  onDuplicate,
}: {
  search: AdminTableSearch
  go: (next: AdminTableSearch, push?: boolean) => void
  onEdit: (b: Banner) => void
  onDuplicate: (b: Banner) => void
}) {
  const { t } = useT()
  const list = useQuery(adminQueries.banners)
  const columns = useBannerColumns({ onEdit, onDuplicate })
  const onNavigate = useCallback(
    (next: AdminTableSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const q = search.q?.trim().toLowerCase()
  const kept = list.data?.filter((b) => !q || b.title.toLowerCase().includes(q))
  return (
    <AdminTable
      label={t("dashboard.nav_banners")}
      columns={columns}
      getRowId={(b) => b.id}
      loading={list.isPending}
      error={list.isError}
      onRetry={() => void list.refetch()}
      search={search}
      onNavigate={onNavigate}
      result={
        kept && {
          items: kept.slice(
            (search.page - 1) * pageSize,
            search.page * pageSize
          ),
          total: kept.length,
          pageSize,
        }
      }
      empty={
        <EmptyState
          icon={ImagesIcon}
          title={t(q ? "admin.banners_empty_filtered" : "admin.banners_empty")}
        />
      }
    />
  )
}
