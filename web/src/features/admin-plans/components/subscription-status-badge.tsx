import { useT } from "@/lib/i18n/use-t"
import type { AdminSubscription } from "@sayaratak/shared/schemas/admin"
import { Badge } from "@/components/ui/badge"

const variants = {
  active: "success",
  pending: "warning",
  expired: "muted",
  canceled: "muted",
} as const

export function SubscriptionStatusBadge({
  status,
}: {
  status: AdminSubscription["status"]
}) {
  const { t } = useT()
  return (
    <Badge variant={variants[status]}>{t(`billing.status_${status}`)}</Badge>
  )
}
