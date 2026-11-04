import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { ReceiptIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { AdminTable } from "@/features/admin/components/admin-table"
import { adminQueries } from "@/features/admin/queries"
import {
  paymentTabs,
  paymentsSearchSchema,
  type PaymentsSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminPaymentCard } from "./admin-payment-card"
import { PaymentSheet } from "./payment-sheet"
import { PaymentSummary } from "./payment-summary"
import { usePaymentColumns } from "./use-payment-columns"

const statusOf = {
  pending: "pending_review",
  approved: "approved",
  rejected: "rejected",
  all: undefined,
} as const

// Bankak receipts to check, pending first. The URL holds the tab, search, page and the payment open in the sheet (`id`); a payment opened from a link loads on its own when it is not on this page.
export function PaymentsPage() {
  const { t, locale } = useT()
  const title = t("dashboard.nav_payments")
  usePageTitle(title)
  const search = paymentsSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { tab, q, page, id } = search
  const list = useQuery(
    adminQueries.payments({ status: statusOf[tab], q, page })
  )
  const inPage = list.data?.items.find((p) => p.id === id)
  const single = useQuery({
    ...adminQueries.payments({ id }),
    enabled: !!id && !!list.data && !inPage,
  })
  const payment = inPage ?? single.data?.items[0]

  // Opening a payment or turning a page adds a history entry, so Back undoes it; the rest replaces.
  const go = useCallback(
    (next: PaymentsSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )
  const onNavigate = useCallback(
    (next: PaymentsSearch) => go(next, next.page !== search.page),
    [go, search.page]
  )
  const open = (p: { id: string }) => go({ ...search, id: p.id }, true)
  const columns = usePaymentColumns(open)
  const empty = q
    ? { title: t("admin.payments_empty_search") }
    : {
        title: t(`admin.payments_empty_${tab}`),
        body: t(`admin.payments_empty_${tab}_body`),
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
      <PaymentSummary summary={list.data?.summary} />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({
            ...search,
            tab: paymentsSearchSchema.shape.tab.parse(next),
            page: 1,
            q: undefined,
          })
        }
      >
        <TabsList aria-label={t("admin.payments_tabs")}>
          {paymentTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`admin.payments_tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          <AdminTable
            label={t("admin.payments_table")}
            columns={columns}
            getRowId={(p) => p.id}
            loading={list.isPending}
            error={list.isError}
            onRetry={() => void list.refetch()}
            search={search}
            onNavigate={onNavigate}
            result={list.data}
            mobileCard={(p) => (
              <AdminPaymentCard payment={p} onOpen={() => open(p)} />
            )}
            empty={<EmptyState icon={ReceiptIcon} {...empty} />}
          />
        </TabsContent>
      </Tabs>
      <PaymentSheet
        open={!!id}
        payment={payment}
        missing={!!id && single.isSuccess && !payment}
        onClose={() => go({ ...search, id: undefined })}
      />
    </div>
  )
}
