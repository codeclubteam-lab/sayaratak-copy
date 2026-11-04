import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { CarIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import {
  adminListingsSearchSchema,
  listingTabs,
  type AdminListingsSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminListingBulkActions } from "./admin-listing-bulk-actions"
import { AdminListingCard } from "./admin-listing-card"
import { AdminListingFilters } from "./admin-listing-filters"
import { AdminListingSheet } from "./admin-listing-sheet"
import { useAdminListingColumns } from "./use-admin-listing-columns"

// Every listing but drafts. The URL holds the tab, filters, search, page and the listing open in the sheet (`id`); a listing opened from a link, or one an action moved off this tab, loads on its own.
export function AdminListingsPage() {
  const { t } = useT()
  const title = t("dashboard.nav_all_listings")
  usePageTitle(title)
  const search = adminListingsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { tab, id, sellerKind, ...rest } = search
  const filters = {
    ...rest,
    moderation: tab === "all" ? undefined : tab,
    sellerKind: sellerKind === "all" ? undefined : sellerKind,
  }
  const list = useQuery(adminQueries.listings(filters))
  const inPage = list.data?.items.find((l) => l.id === id)
  const single = useQuery({
    ...adminQueries.listings({ id }),
    enabled: !!id && !!list.data && !inPage,
  })
  const listing = inPage ?? single.data?.items[0]

  // Opening a listing or turning a page adds a history entry, so Back undoes it; the rest replaces.
  const go = useCallback(
    (next: AdminListingsSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const onNavigate = useCallback(
    (next: AdminListingsSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const open = (l: { id: string }) => go({ ...search, id: l.id }, true)
  const columns = useAdminListingColumns(open)
  const narrowed =
    !!search.q ||
    !!search.type ||
    !!search.cityId ||
    !!search.promoted ||
    !!search.ownerId ||
    sellerKind !== "all"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({
            ...search,
            tab: adminListingsSearchSchema.shape.tab.parse(next),
            page: 1,
          })
        }
      >
        <TabsList
          aria-label={t("admin.listings_tabs")}
          className="max-w-full overflow-x-auto"
        >
          {listingTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(
                value === "all" ? "admin.listings_tab_all" : `status.${value}`
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          <AdminTable
            label={t("admin.listings_table")}
            columns={columns}
            getRowId={(l) => l.id}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
            search={search}
            onNavigate={onNavigate}
            result={list.data}
            filters={
              <AdminListingFilters
                search={search}
                onChange={(next) => onNavigate({ ...search, ...next, page: 1 })}
              />
            }
            bulkActions={(ids, clear) => (
              <AdminListingBulkActions tab={tab} ids={ids} clear={clear} />
            )}
            mobileCard={(l) => (
              <AdminListingCard listing={l} onOpen={() => open(l)} />
            )}
            empty={
              <EmptyState
                icon={CarIcon}
                title={t(
                  narrowed
                    ? "admin.listings_empty_filtered"
                    : "admin.listings_empty"
                )}
              />
            }
          />
        </TabsContent>
      </Tabs>
      <AdminListingSheet
        open={!!id}
        listing={listing}
        missing={!!id && single.isSuccess && !listing}
        onClose={() => go({ ...search, id: undefined })}
      />
    </div>
  )
}
