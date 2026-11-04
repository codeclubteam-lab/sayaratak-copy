import { useT } from "@/lib/i18n/use-t"
import type { BroadcastStatus } from "@sayaratak/shared/schemas/api"
import { Badge } from "@/components/ui/badge"

const variants = {
  queued: "muted",
  sending: "warning",
  sent: "success",
} as const

// Where a broadcast is: waiting for the job, being rung in chunks, or done.
export function BroadcastStatusBadge({ status }: { status: BroadcastStatus }) {
  const { t } = useT()
  return (
    <Badge variant={variants[status]}>
      {t(`admin.broadcast_status_${status}`)}
    </Badge>
  )
}
