import { useT } from "@/lib/i18n/use-t"
import { Badge } from "@/components/ui/badge"

export function VerifiedBadge() {
  const { t } = useT()
  return <Badge variant="primary">{t("listing.verified")}</Badge>
}
