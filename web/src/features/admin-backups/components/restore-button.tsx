import { useT } from "@/lib/i18n/use-t"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { Button } from "@/components/ui/button"

// Only a finished backup can be restored, and only one restore runs at a time.
export function RestoreButton({
  backup,
  date,
  busy,
  onRestore,
}: {
  backup: Backup
  date: string
  busy: boolean
  onRestore: () => void
}) {
  const { t } = useT()
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={busy || backup.status !== "ready"}
      aria-label={t("admin.backup_restore_label", { date })}
      onClick={onRestore}
    >
      {t("admin.backup_restore")}
    </Button>
  )
}
