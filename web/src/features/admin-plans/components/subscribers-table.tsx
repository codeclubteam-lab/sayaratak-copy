import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { UsersIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import type { PlansSearch } from "@/features/admin/schemas"
import { EmptyState } from "@/components/app/empty-state"
import { SubscriberCard } from "./subscriber-card"
import { SubscriberFilters } from "./subscriber-filters"
import { useSubscriberColumns } from "./use-subscriber-columns"

// Every subscription, newest first. Filters, search and page live in the URL; turning a page adds a history entry.
export function SubscribersTable({
  search,
  go,
}: {
  search: PlansSearch
  go: (next: PlansSearch, push?: boolean) => void
}) {
  const { t } = useT()
  const { audience, planId, status, q, page } = search
  const list = useQuery(
    adminQueries.subscriptions({ audience, planId, status, q, page })
  )
  const columns = useSubscriberColumns()
  const onNavigate = useCallback(
    (next: PlansSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const narrowed = !!(q || audience || planId || status)
  return (
    <AdminTable
      label={t("admin.plans_subscribers_table")}
      columns={columns}
      getRowId={(s) => s.id}
      loading={list.isPending}
      error={list.isError}
      onRetry={() => void list.refetch()}
      search={search}
      onNavigate={onNavigate}
      result={list.data}
      filters={
        <SubscriberFilters
          search={search}
          onChange={(next) => onNavigate({ ...search, ...next, page: 1 })}
        />
      }
      mobileCard={(s) => <SubscriberCard sub={s} />}
      empty={
        <EmptyState
          icon={UsersIcon}
          title={t(
            narrowed
              ? "admin.businesses_empty_filtered"
              : "admin.plans_subscribers_empty"
          )}
        />
      }
    />
  )
}
