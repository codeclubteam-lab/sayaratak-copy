import { useCallback, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { BuildingIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import {
  businessesSearchSchema,
  type BusinessesSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { BusinessCard } from "./business-card"
import type { BusinessChange } from "./business-change"
import { BusinessChangeDialog } from "./business-change-dialog"
import { BusinessFilters } from "./business-filters"
import { BusinessSheet } from "./business-sheet"
import { useBusinessColumns } from "./use-business-columns"

// Dealerships, workshops or mechanics. The URL holds the filters, search, page and the business open in the sheet (`id`); one opened from a link loads on its own.
export function BusinessesPage({ type }: { type: AdminBusiness["type"] }) {
  const { t, locale } = useT()
  const title = t(`dashboard.nav_${type}s`)
  usePageTitle(title)
  const search = businessesSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const [change, setChange] = useState<BusinessChange | null>(null)
  const { id, ...filters } = search
  const list = useQuery(adminQueries.businesses({ type, ...filters }))
  const inPage = list.data?.items.find((b) => b.id === id)
  const single = useQuery({
    ...adminQueries.businesses({ type, id }),
    enabled: !!id && !!list.data && !inPage,
  })
  const business = inPage ?? single.data?.items[0]

  // Opening a business or turning a page adds a history entry, so Back undoes it; the rest replaces.
  const go = useCallback(
    (next: BusinessesSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const onNavigate = useCallback(
    (next: BusinessesSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const open = (b: { id: string }) => go({ ...search, id: b.id }, true)
  const columns = useBusinessColumns(type, open, setChange)
  const narrowed =
    !!search.q ||
    !!search.cityId ||
    !!search.verified ||
    !!search.status ||
    !!search.planId

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={list.data && formatNumber(list.data.total, locale)}
      />
      <AdminTable
        label={title}
        columns={columns}
        getRowId={(b) => b.id}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => void list.refetch()}
        search={search}
        onNavigate={onNavigate}
        result={list.data}
        filters={
          <BusinessFilters
            type={type}
            search={search}
            onChange={(next) => onNavigate({ ...search, ...next, page: 1 })}
          />
        }
        mobileCard={(b) => (
          <BusinessCard business={b} onOpen={() => open(b)} onAsk={setChange} />
        )}
        empty={
          <EmptyState
            icon={BuildingIcon}
            title={t(
              narrowed
                ? "admin.businesses_empty_filtered"
                : `admin.businesses_empty_${type}`
            )}
          />
        }
      />
      <BusinessSheet
        open={!!id}
        business={business}
        missing={!!id && single.isSuccess && !business}
        onClose={() => go({ ...search, id: undefined })}
        onAsk={setChange}
      />
      <BusinessChangeDialog change={change} onClose={() => setChange(null)} />
    </div>
  )
}
