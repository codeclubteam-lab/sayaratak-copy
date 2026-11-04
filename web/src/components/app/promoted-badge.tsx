import { useT } from "@/lib/i18n/use-t"
import { Badge } from "@/components/ui/badge"

// Amber means paid promotion and nothing else (A5).
export function PromotedBadge() {
  const { t } = useT()
  return <Badge variant="signal">{t("listing.featured")}</Badge>
}
