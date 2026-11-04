import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { BadgeCheckIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import {
  verificationTabs,
  verificationsSearchSchema,
  type VerificationsSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useVerificationColumns } from "./use-verification-columns"
import { VerificationCard } from "./verification-card"
import { VerificationSheet } from "./verification-sheet"

// Verification requests from businesses, pending first. The URL holds the tab, search, page and the request open in the sheet (`id`); a request opened from a link loads on its own when it is not on this page.
export function VerificationsPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_verifications")
  usePageTitle(title)
  const search = verificationsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { tab, q, page, id } = search
  const list = useQuery(adminQueries.verifications({ status: tab, q, page }))
  const inPage = list.data?.items.find((r) => r.id === id)
  const single = useQuery({
    ...adminQueries.verifications({ id }),
    enabled: !!id && !!list.data && !inPage,
  })
  const request = inPage ?? single.data?.items[0]

  // Opening a request or turning a page adds a history entry, so Back undoes it; the rest replaces.
  const go = useCallback(
    (next: VerificationsSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const onNavigate = useCallback(
    (next: VerificationsSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const open = (r: { id: string }) => go({ ...search, id: r.id }, true)
  const columns = useVerificationColumns(open)
  const empty = q
    ? { title: t("admin.verifications_empty_search") }
    : {
        title: t(`admin.verifications_empty_${tab}`),
        body: t(`admin.verifications_empty_${tab}_body`),
      }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        count={
          list.data && tab === "pending"
            ? formatNumber(list.data.total, locale)
            : undefined
        }
      />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({
            ...search,
            tab: verificationsSearchSchema.shape.tab.parse(next),
            page: 1,
            q: undefined,
          })
        }
      >
        <TabsList aria-label={t("admin.verifications_tabs")}>
          {verificationTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`admin.verifications_tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          <AdminTable
            label={t("admin.verifications_table")}
            columns={columns}
            getRowId={(r) => r.id}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
            search={search}
            onNavigate={onNavigate}
            result={list.data}
            mobileCard={(r) => (
              <VerificationCard request={r} onOpen={() => open(r)} />
            )}
            empty={<EmptyState icon={BadgeCheckIcon} {...empty} />}
          />
        </TabsContent>
      </Tabs>
      <VerificationSheet
        open={!!id}
        request={request}
        missing={!!id && single.isSuccess && !request}
        onClose={() => go({ ...search, id: undefined })}
      />
    </div>
  )
}
