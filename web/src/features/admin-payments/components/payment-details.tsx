import type { ReactNode } from "react"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { AdminPayment } from "@sayaratak/shared/schemas/responses"
import { PriceText } from "@/components/app/price-text"
import { PaymentStatusBadge } from "@/features/billing/components/payment-status-badge"
import { paymentItem } from "./payment-item"
import { ReceiptViewer } from "./receipt-viewer"

const link = "text-ui font-medium text-primary hover:underline"

// The body of the payment sheet: what to look for on the receipt, the receipt itself, then what approval starts.
export function PaymentDetails({ payment }: { payment: AdminPayment }) {
  const { t, locale } = useT()
  const { order } = payment
  const fact = (label: string, value: ReactNode) => (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end font-medium break-words">{value}</dd>
    </div>
  )
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <PriceText price={payment.amount} />
          <PaymentStatusBadge status={payment.status} />
        </div>
        <p className="text-caption text-muted-foreground">
          {t("admin.payment_submitted_on", {
            date: formatDate(payment.createdAt, locale),
          })}
          {payment.reviewedAt &&
            ` · ${t("admin.payment_reviewed_on", { date: formatDate(payment.reviewedAt, locale) })}`}
        </p>
      </section>
      {payment.rejectionReason && (
        <section className="flex flex-col gap-1">
          <h3 className="text-ui font-semibold">
            {t("admin.payment_rejection")}
          </h3>
          <p className="text-body whitespace-pre-line">
            {payment.rejectionReason}
          </p>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h3 className="text-ui font-semibold">{t("admin.payment_check")}</h3>
        <dl className="flex flex-col gap-2 text-ui">
          {fact(
            t("admin.payment_expected"),
            <PriceText price={payment.amount} size="table" />
          )}
          {fact(
            t("admin.payment_col_reference"),
            <bdi dir="ltr" className="num">
              {payment.reference}
            </bdi>
          )}
          {fact(
            t("admin.payment_col_transaction"),
            <bdi dir="ltr" className="num">
              {payment.transactionRef}
            </bdi>
          )}
          {fact(t("admin.payment_payer"), <bdi>{payment.payerName}</bdi>)}
        </dl>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-ui font-semibold">{t("admin.payment_receipt")}</h3>
        <ReceiptViewer url={payment.receiptUrl} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-ui font-semibold">
          {t(
            payment.status === "pending_review"
              ? "admin.payment_order_pending"
              : "admin.payment_order"
          )}
        </h3>
        <dl className="flex flex-col gap-2 text-ui">
          {fact(
            t(`admin.payment_type_${payment.itemType}`),
            <bdi>{paymentItem(t, payment, locale)}</bdi>
          )}
          {order.durationDays > 0 &&
            fact(
              t("billing.order_duration"),
              t("billing.duration_days", { count: order.durationDays })
            )}
          {fact(t("admin.payment_col_user"), <bdi>{payment.user.name}</bdi>)}
        </dl>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {order.listing && (
            <a
              href={localeHref(`/listings/${order.listing.slug}`, locale)}
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              {t("admin.payment_open_listing")}
            </a>
          )}
          <a
            href={localeHref(`/admin/users?id=${payment.userId}`, locale)}
            className={link}
          >
            {t("admin.open_user")}
          </a>
        </div>
      </section>
    </div>
  )
}
