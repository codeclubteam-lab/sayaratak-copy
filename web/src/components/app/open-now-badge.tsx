import { isOpenNow } from "@/lib/hours"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"
import { Badge } from "@/components/ui/badge"

// Text and color together, so the state never rests on color alone.
export function OpenNowBadge({ hours }: { hours: WeeklyHours }) {
  const { t } = useT()
  const open = isOpenNow(hours, useNow())
  return (
    <Badge variant={open ? "success" : "muted"}>
      {t(open ? "hours.open_now" : "hours.closed")}
    </Badge>
  )
}
