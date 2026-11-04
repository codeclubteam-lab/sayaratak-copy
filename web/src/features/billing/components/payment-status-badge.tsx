import { useT } from "@/lib/i18n/use-t"
import type { Payment } from "@sayaratak/shared/schemas/billing"
import { Badge } from "@/components/ui/badge"

const variants = {
  pending_review: "warning",
  approved: "success",
  rejected: "destructive",
} as const

export function PaymentStatusBadge({ status }: { status: Payment["status"] }) {
  const { t } = useT()
  return (
    <Badge variant={variants[status]}>
      {t(`billing.payment_status_${status}`)}
    </Badge>
  )
}
