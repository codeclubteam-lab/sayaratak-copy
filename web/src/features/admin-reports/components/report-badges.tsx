import { Badge } from "@/components/ui/badge"
import { useT } from "@/lib/i18n/use-t"
import type { Report } from "@sayaratak/shared/schemas/admin"

const reasonVariant = {
  scam: "destructive",
  inappropriate: "warning",
  wrong_category: "muted",
  already_sold: "muted",
  duplicate: "muted",
  other: "muted",
} as const
const statusVariant = {
  open: "warning",
  dismissed: "muted",
  actioned: "success",
} as const

// The buyer's reason, worded as the report dialog words it (its "other" key is `report_misc`).
export function ReasonBadge({ reason }: { reason: Report["reason"] }) {
  const { t } = useT()
  return (
    <Badge variant={reasonVariant[reason]}>
      {t(`listing.report_${reason === "other" ? "misc" : reason}`)}
    </Badge>
  )
}

export function ReportStatusBadge({ status }: { status: Report["status"] }) {
  const { t } = useT()
  return (
    <Badge variant={statusVariant[status]}>
      {t(`admin.report_status_${status}`)}
    </Badge>
  )
}
