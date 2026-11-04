import { PriceText } from "@/components/app/price-text"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Payment } from "@sayaratak/shared/schemas/billing"
import { PaymentStatusBadge } from "./payment-status-badge"
import { ReceiptLink } from "./receipt-link"

// One payment as a card, for the history table below md.
export function PaymentCard({ payment }: { payment: Payment }) {
  const { t, locale } = useT()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-ui font-medium">{payment.itemLabel[locale]}</p>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
        <span>{formatDate(payment.createdAt, locale)}</span>
        <bdi className="num">{payment.reference}</bdi>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PriceText price={payment.amount} size="table" />
        <ReceiptLink payment={payment} />
      </div>
      {payment.status === "rejected" && payment.rejectionReason && (
        <p className="text-caption text-destructive">
          {t("billing.reason", { reason: payment.rejectionReason })}
        </p>
      )}
    </article>
  )
}
