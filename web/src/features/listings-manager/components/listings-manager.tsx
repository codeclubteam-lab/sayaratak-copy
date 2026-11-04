import { useCallback, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CarIcon } from "lucide-react"
import { Link, useLocation } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"

import { DataTable } from "@/components/app/data-table"
import { EmptyState } from "@/components/app/empty-state"
import { LimitMeter } from "@/components/app/limit-meter"
import { PageHeader } from "@/components/app/page-header"
import { resultsHeadingId } from "@/components/app/results-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { meQuery } from "@/features/auth/me-query"
import { billingQueries } from "@/features/billing/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PromoteDialog } from "@/features/billing/components/promote-dialog"
import { listingQueries } from "@/features/listings/queries"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import {
  listingsManagerSearchSchema,
  managerTabs,
  pruneSearch,
  type ListingsManagerSearch,
  type PrunedSearch,
} from "../schemas"
import { useListingActions } from "../use-listing-actions"
import { DraftBanner } from "./draft-banner"
import { ListingAnalyticsSheet } from "./listing-analytics-sheet"
import { ListingManagerCard } from "./listing-manager-card"
import { ManagerBulkActions } from "./manager-bulk-actions"
import { ManagerFilters } from "./manager-filters"
import { useExportListings } from "./use-export-listings"
import { useListingColumns } from "./use-listing-columns"

const PAGE_SIZE = 24

// The seller's listings table (steps 9.3 and 10.3 mount it). The URL holds tab, search, filters, sort and page; `scope` only decides the title.
export function ListingsManager({
  scope,
  search,
  onNavigate,
}: {
  scope: "user" | "dealer"
  search: ListingsManagerSearch
  // The route's own `navigate`, wrapped in `useCallback` so the search box keeps its pause between keystrokes.
  onNavigate: (search: PrunedSearch, replace: boolean) => void
}) {
  const { t, locale } = useT()
  const pathname = useLocation({ select: (l) => l.pathname })
  const me = useQuery(meQuery).data
  const subscription = useQuery(billingQueries.subscription).data
  const actions = useListingActions()
  const exportCsv = useExportListings()
  const [analytics, setAnalytics] = useState<Listing>()
  const [promote, setPromote] = useState<Listing>()
  // Selection belongs to one page of results: it is dropped when the URL changes.
  const urlKey = JSON.stringify(search)
  const [picked, setPicked] = useState<{
    urlKey: string
    rows: RowSelectionState
  }>({ urlKey, rows: {} })
  const selection = picked.urlKey === urlKey ? picked.rows : {}

  const title = t(
    scope === "dealer" ? "dashboard.nav_inventory" : "dashboard.nav_listings"
  )
  usePageTitle(title)

  const { tab, q, type, intent, sort, dir, page } = search
  const list = useQuery(
    listingQueries.mine({
      tab,
      q,
      type,
      intent,
      sort,
      dir,
      page,
      pageSize: PAGE_SIZE,
    })
  )
  const rows = list.data?.items
  const total = list.data?.total ?? 0
  const chosen = rows?.filter((l) => selection[l.id]) ?? []

  const go = useCallback(
    (next: ListingsManagerSearch, replace = true) =>
      onNavigate(pruneSearch(next), replace),
    [onNavigate]
  )
  // A change to the tab, search or filters starts again at page 1.
  const change = (next: Partial<ListingsManagerSearch>) =>
    go({ ...search, page: 1, ...next })
  const onSearch = useCallback(
    (value: string) =>
      go({
        ...search,
        q: listingsManagerSearchSchema.shape.q.parse(value),
        page: 1,
      }),
    [go, search]
  )
  const onSort = (value: string) => {
    const at = value.lastIndexOf("_")
    const { shape } = listingsManagerSearchSchema
    change({
      sort: shape.sort.parse(value.slice(0, at)),
      dir: shape.dir.parse(value.slice(at + 1)),
    })
  }
  const hrefFor = (p: number) => {
    const query = new URLSearchParams(
      Object.entries(pruneSearch({ ...search, page: p })).map(([k, v]) => [
        k,
        String(v),
      ])
    ).toString()
    return localeHref(`${pathname}${query && `?${query}`}`, locale)
  }

  const columns = useListingColumns({
    actions,
    onAnalytics: setAnalytics,
    onPromote: setPromote,
  })
  const limit = subscription?.usage.limit ?? null
  const used = subscription?.usage.used ?? 0
  const reached = limit !== null && used >= limit
  const billing = (
    <a
      href={localeHref(`${dashboardPath(me?.role)}/billing`, locale)}
      className={buttonVariants({ variant: "link", size: "sm" })}
    >
      {t("post.limit_upgrade")}
    </a>
  )
  const filtered = !!(q || type || intent)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        headingId={resultsHeadingId}
        count={list.data ? formatNumber(total, locale) : undefined}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportCsv()}
        >
          {t("manager.export_csv")}
        </Button>
        {reached ? (
          <Button type="button" disabled>
            {t("listing.post")}
          </Button>
        ) : (
          <Link
            to={
              scope === "dealer"
                ? "/$locale/dealer/inventory/new"
                : "/$locale/post"
            }
            params={{ locale }}
            className={buttonVariants()}
          >
            {t("listing.post")}
          </Link>
        )}
      </PageHeader>
      {limit !== null && (
        <div className="flex flex-col items-start gap-1">
          <LimitMeter
            label={t("post.limit_label")}
            used={used}
            limit={limit}
            action={billing}
          />
          {!reached && used >= limit * 0.8 && billing}
        </div>
      )}
      <Tabs
        value={tab}
        onValueChange={(next) =>
          change({ tab: listingsManagerSearchSchema.shape.tab.parse(next) })
        }
      >
        <TabsList
          aria-label={t("manager.tabs_label")}
          className="max-w-full overflow-x-auto"
        >
          {managerTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`manager.tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          {tab === "drafts" && <DraftBanner dealer={scope === "dealer"} />}
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(l) => l.id}
            label={t("manager.table_label")}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
            sort={`${sort}_${dir}`}
            onSortChange={onSort}
            search={q}
            onSearch={onSearch}
            filters={<ManagerFilters search={search} onChange={change} />}
            selection={{
              value: selection,
              onChange: (next) => setPicked({ urlKey, rows: next }),
              actions: (
                <ManagerBulkActions
                  rows={chosen}
                  actions={actions}
                  onDone={() => setPicked({ urlKey, rows: {} })}
                />
              ),
            }}
            mobileCard={(l) => (
              <ListingManagerCard
                listing={l}
                actions={actions}
                onAnalytics={setAnalytics}
                onPromote={setPromote}
              />
            )}
            empty={
              <EmptyState
                icon={CarIcon}
                title={t("manager.empty_title")}
                body={t(
                  filtered ? "manager.empty_filtered" : "manager.empty_body"
                )}
              />
            }
            page={page}
            pageCount={Math.ceil(total / PAGE_SIZE)}
            hrefFor={hrefFor}
            onPageChange={(p) => go({ ...search, page: p }, false)}
          />
        </TabsContent>
      </Tabs>
      {promote && (
        <PromoteDialog
          listingId={promote.id}
          onClose={() => setPromote(undefined)}
        />
      )}
      {analytics && (
        <ListingAnalyticsSheet
          listing={analytics}
          onClose={() => setAnalytics(undefined)}
        />
      )}
    </div>
  )
}
