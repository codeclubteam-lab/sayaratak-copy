import { useT } from "@/lib/i18n/use-t"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

const variant = {
  running: "primary",
  ready: "success",
  restoring: "primary",
  failed: "destructive",
} as const

export function BackupStatus({ status }: { status: Backup["status"] }) {
  const { t } = useT()
  return (
    <Badge variant={variant[status]}>
      {status === "running" && (
        <Spinner aria-hidden="true" className="size-3" />
      )}
      {t(`admin.backup_status_${status}`)}
    </Badge>
  )
}
