import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminPayment } from "@sayaratak/shared/schemas/responses"
import { PriceText } from "@/components/app/price-text"
import { PaymentStatusBadge } from "@/features/billing/components/payment-status-badge"
import { paymentItem } from "./payment-item"
import { PaymentReferenceCell } from "./payment-reference-cell"

// One payment below md: reference and status, what it buys and the amount, then the payer and when.
export function AdminPaymentCard({
  payment,
  onOpen,
}: {
  payment: AdminPayment
  onOpen: () => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <PaymentReferenceCell payment={payment} onOpen={onOpen} />
        <PaymentStatusBadge status={payment.status} />
      </div>
      <p className="text-ui">
        <bdi>{paymentItem(t, payment, locale)}</bdi>
      </p>
      <PriceText price={payment.amount} size="table" />
      <p className="text-caption text-muted-foreground">
        <bdi>{payment.user.name}</bdi>
        {" · "}
        {formatRelative(payment.createdAt, now, locale)}
      </p>
    </article>
  )
}
