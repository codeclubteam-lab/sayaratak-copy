import { useQuery } from "@tanstack/react-query"
import { ReceiptIcon } from "lucide-react"

import { DataTable } from "@/components/app/data-table"
import { EmptyState } from "@/components/app/empty-state"
import { PriceText } from "@/components/app/price-text"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { Payment } from "@sayaratak/shared/schemas/billing"
import { billingQueries } from "../queries"
import { PaymentCard } from "./payment-card"
import { PaymentStatusBadge } from "./payment-status-badge"
import { ReceiptLink } from "./receipt-link"

export const PAYMENTS_PAGE_SIZE = 20

// The payer's own payments, newest first. A rejected row says why under its badge.
export function PaymentHistoryTable({
  page,
  hrefFor,
  onPageChange,
}: {
  page: number
  hrefFor: (page: number) => string
  onPageChange: (page: number) => void
}) {
  const { t, locale } = useT()
  const list = useQuery(
    billingQueries.payments({ page, pageSize: PAYMENTS_PAGE_SIZE })
  )
  const columns: DataColumn<Payment>[] = [
    {
      id: "date",
      header: t("billing.col_date"),
      enableHiding: false,
      cell: ({ row }) => formatDate(row.original.createdAt, locale),
    },
    {
      id: "item",
      header: t("billing.col_item"),
      cell: ({ row }) => row.original.itemLabel[locale],
    },
    {
      id: "amount",
      header: t("billing.col_amount"),
      cell: ({ row }) => <PriceText price={row.original.amount} size="table" />,
    },
    {
      id: "reference",
      header: t("billing.col_reference"),
      cell: ({ row }) => <bdi className="num">{row.original.reference}</bdi>,
    },
    {
      id: "status",
      header: t("billing.col_status"),
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <PaymentStatusBadge status={row.original.status} />
          {row.original.status === "rejected" &&
            row.original.rejectionReason && (
              <span className="text-caption text-destructive">
                {t("billing.reason", { reason: row.original.rejectionReason })}
              </span>
            )}
        </div>
      ),
    },
    {
      id: "receipt",
      header: t("billing.col_receipt"),
      cell: ({ row }) => <ReceiptLink payment={row.original} />,
    },
  ]
  return (
    <DataTable
      columns={columns}
      data={list.data?.items}
      getRowId={(p) => p.id}
      label={t("billing.history_label")}
      loading={list.isPending}
      error={list.isError && !list.data}
      onRetry={() => void list.refetch()}
      mobileCard={(p) => <PaymentCard payment={p} />}
      empty={
        <EmptyState
          icon={ReceiptIcon}
          title={t("billing.history_empty_title")}
          body={t("billing.history_empty_body")}
        />
      }
      page={page}
      pageCount={Math.ceil((list.data?.total ?? 0) / PAYMENTS_PAGE_SIZE)}
      hrefFor={hrefFor}
      onPageChange={onPageChange}
    />
  )
}
