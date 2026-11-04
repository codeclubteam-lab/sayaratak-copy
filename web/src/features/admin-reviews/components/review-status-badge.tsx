import { Badge } from "@/components/ui/badge"
import { useT } from "@/lib/i18n/use-t"
import type { Review } from "@sayaratak/shared/schemas/review"

const variant = {
  visible: "success",
  flagged: "warning",
  hidden: "muted",
} as const

export function ReviewStatusBadge({ status }: { status: Review["status"] }) {
  const { t } = useT()
  return (
    <Badge variant={variant[status]}>
      {t(`admin.review_status_${status}`)}
    </Badge>
  )
}
