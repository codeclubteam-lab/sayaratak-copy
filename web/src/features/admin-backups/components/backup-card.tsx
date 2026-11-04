import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { Badge } from "@/components/ui/badge"
import { BackupStatus } from "./backup-status"
import { RestoreButton } from "./restore-button"
import { backupDate } from "./use-backup-columns"

// One backup below md.
export function BackupCard({
  backup,
  busy,
  onRestore,
}: {
  backup: Backup
  busy: boolean
  onRestore: () => void
}) {
  const { t, locale } = useT()
  const date = backupDate(backup.createdAt, locale)
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <span className="text-ui font-medium">{date}</span>
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
        <Badge variant={backup.type === "auto" ? "muted" : "primary"}>
          {t(`admin.backup_type_${backup.type}`)}
        </Badge>
        <BackupStatus status={backup.status} />
        <span>
          {t("admin.backup_size", {
            size: formatNumber(backup.sizeMb, locale),
          })}
        </span>
      </div>
      <RestoreButton
        backup={backup}
        date={date}
        busy={busy}
        onRestore={onRestore}
      />
    </article>
  )
}
