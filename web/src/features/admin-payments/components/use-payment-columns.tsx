import type { DataColumn } from "@/lib/table"
import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminPayment } from "@sayaratak/shared/schemas/responses"
import { PriceText } from "@/components/app/price-text"
import { PaymentStatusBadge } from "@/features/billing/components/payment-status-badge"
import { paymentItem } from "./payment-item"
import { PaymentReferenceCell } from "./payment-reference-cell"

// Columns of the payments table. The server keeps them newest first, so no column sorts.
export function usePaymentColumns(
  onOpen: (payment: AdminPayment) => void
): DataColumn<AdminPayment>[] {
  const { t, locale } = useT()
  const now = useNow()
  return [
    {
      id: "reference",
      header: t("admin.payment_col_reference"),
      enableHiding: false,
      cell: ({ row }) => (
        <PaymentReferenceCell
          payment={row.original}
          onOpen={() => onOpen(row.original)}
        />
      ),
    },
    {
      id: "user",
      header: t("admin.payment_col_user"),
      cell: ({ row }) => <bdi>{row.original.user.name}</bdi>,
    },
    {
      id: "item",
      header: t("admin.payment_col_item"),
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-64">
          <bdi>{paymentItem(t, row.original, locale)}</bdi>
        </span>
      ),
    },
    {
      id: "amount",
      header: t("admin.payment_col_amount"),
      cell: ({ row }) => <PriceText price={row.original.amount} size="table" />,
    },
    {
      id: "transaction",
      header: t("admin.payment_col_transaction"),
      cell: ({ row }) => (
        <bdi dir="ltr" className="num">
          {row.original.transactionRef}
        </bdi>
      ),
    },
    {
      id: "submitted",
      header: t("admin.payment_col_submitted"),
      cell: ({ row }) => formatRelative(row.original.createdAt, now, locale),
    },
    {
      id: "status",
      header: t("admin.payment_col_status"),
      cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
    },
  ]
}
