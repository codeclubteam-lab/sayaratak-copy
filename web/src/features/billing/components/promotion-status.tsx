import { Link } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"

// Active and ended are badges. An unpaid promotion links to its checkout, unless its receipt is waiting for the admin.
export function PromotionStatus({ promotion }: { promotion: MyPromotion }) {
  const { t, locale } = useT()
  if (promotion.status === "active")
    return <Badge variant="success">{t("billing.promos_status_active")}</Badge>
  if (promotion.status === "ended")
    return <Badge>{t("billing.promos_status_ended")}</Badge>
  if (promotion.paymentStatus === "pending_review")
    return (
      <Badge variant="warning">{t("billing.promos_status_in_review")}</Badge>
    )
  return (
    <div className="flex flex-col items-start gap-1">
      <Link
        to="/$locale/dealer/billing/checkout"
        params={{ locale }}
        search={{ item: `promotion:${promotion.id}` }}
        className={buttonVariants({ size: "sm" })}
      >
        {t("billing.promos_pay_now")}
      </Link>
      {promotion.paymentStatus === "rejected" && (
        <span className="text-caption text-destructive">
          {t("billing.promos_payment_rejected")}
        </span>
      )}
    </div>
  )
}
