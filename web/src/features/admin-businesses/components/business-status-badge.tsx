import { Badge } from "@/components/ui/badge"
import { useT } from "@/lib/i18n/use-t"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"

export function BusinessStatusBadge({ business }: { business: AdminBusiness }) {
  const { t } = useT()
  return business.status === "active" ? (
    <Badge variant="success">{t("admin.business_status_active")}</Badge>
  ) : (
    <Badge variant="destructive">{t("admin.business_status_suspended")}</Badge>
  )
}
