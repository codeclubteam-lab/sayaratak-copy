import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { UsersIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import { usersSearchSchema, type UsersSearch } from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { UserCard } from "./user-card"
import { UserFilters } from "./user-filters"
import { UserSheet } from "./user-sheet"
import { useUserColumns } from "./use-user-columns"

// Every account. The URL holds the filters, search, page and the person open in the sheet (`id`); a person opened from a link loads on their own.
export function UsersPage() {
  const { t } = useT()
  const title = t("dashboard.nav_users")
  usePageTitle(title)
  const search = usersSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { id, ...filters } = search
  const list = useQuery(adminQueries.users(filters))
  const inPage = list.data?.items.find((u) => u.id === id)
  const single = useQuery({
    ...adminQueries.users({ id }),
    enabled: !!id && !!list.data && !inPage,
  })
  const user = inPage ?? single.data?.items[0]

  // Opening a person or turning a page adds a history entry, so Back undoes it; the rest replaces.
  const go = useCallback(
    (next: UsersSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const onNavigate = useCallback(
    (next: UsersSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const open = (u: { id: string }) => go({ ...search, id: u.id }, true)
  const columns = useUserColumns(open)
  const narrowed = !!search.q || !!search.role || !!search.status

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <AdminTable
        label={t("admin.users_table")}
        columns={columns}
        getRowId={(u) => u.id}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => void list.refetch()}
        search={search}
        onNavigate={onNavigate}
        result={list.data}
        filters={
          <UserFilters
            search={search}
            onChange={(next) => onNavigate({ ...search, ...next, page: 1 })}
          />
        }
        mobileCard={(u) => <UserCard user={u} onOpen={() => open(u)} />}
        empty={
          <EmptyState
            icon={UsersIcon}
            title={t(
              narrowed ? "admin.users_empty_filtered" : "admin.users_empty"
            )}
          />
        }
      />
      <UserSheet
        open={!!id}
        user={user}
        missing={!!id && single.isSuccess && !user}
        onClose={() => go({ ...search, id: undefined })}
      />
    </div>
  )
}
