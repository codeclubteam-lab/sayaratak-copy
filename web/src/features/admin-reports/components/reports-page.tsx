import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { FlagIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import {
  reportTabs,
  reportsSearchSchema,
  type ReportsSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReportCard } from "./report-card"
import { ReportSheet } from "./report-sheet"
import { useReportColumns } from "./use-report-columns"

// Reports from buyers, open first. The URL holds the tab, search, page and the report open in the sheet (`id`); a report opened from a link loads on its own when it is not on this page.
export function ReportsPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_reports")
  usePageTitle(title)
  const search = reportsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { tab, q, page, id } = search
  const list = useQuery(adminQueries.reports({ status: tab, q, page }))
  const inPage = list.data?.items.find((r) => r.id === id)
  const single = useQuery({
    ...adminQueries.reports({ id }),
    enabled: !!id && !!list.data && !inPage,
  })
  const report = inPage ?? single.data?.items[0]

  // Opening a report or turning a page adds a history entry, so Back undoes it; the rest replaces.
  const go = useCallback(
    (next: ReportsSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const onNavigate = useCallback(
    (next: ReportsSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const columns = useReportColumns((r) => go({ ...search, id: r.id }, true))
  const empty = q
    ? { title: t("admin.reports_empty_search") }
    : {
        title: t(`admin.reports_empty_${tab}`),
        body: t(`admin.reports_empty_${tab}_body`),
      }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={
          list.data && tab === "open"
            ? formatNumber(list.data.total, locale)
            : undefined
        }
      />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({
            ...search,
            tab: reportsSearchSchema.shape.tab.parse(next),
            page: 1,
            q: undefined,
          })
        }
      >
        <TabsList aria-label={t("admin.reports_tabs")}>
          {reportTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`admin.reports_tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          <AdminTable
            label={t("admin.reports_table")}
            columns={columns}
            getRowId={(r) => r.id}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
            search={search}
            onNavigate={onNavigate}
            result={list.data}
            mobileCard={(r) => (
              <ReportCard
                report={r}
                onOpen={() => go({ ...search, id: r.id }, true)}
              />
            )}
            empty={<EmptyState icon={FlagIcon} {...empty} />}
          />
        </TabsContent>
      </Tabs>
      <ReportSheet
        open={!!id}
        report={report}
        missing={!!id && single.isSuccess && !report}
        onClose={() => go({ ...search, id: undefined })}
      />
    </div>
  )
}
