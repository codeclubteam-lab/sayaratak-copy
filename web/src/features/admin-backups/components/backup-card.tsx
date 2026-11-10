import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { Badge } from "@/components/ui/badge"
import { BackupStatus } from "./backup-status"
import { BackupId, backupDate } from "./use-backup-columns"

// One backup below md.
export function BackupCard({ backup }: { backup: Backup }) {
  const { t, locale } = useT()
  const date = backupDate(backup.createdAt, locale)
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ui font-medium">{date}</span>
        <BackupStatus status={backup.status} />
      </div>
      <BackupId id={backup.id} />
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
        <Badge variant={backup.type === "auto" ? "muted" : "primary"}>
          {t(`admin.backup_type_${backup.type}`)}
        </Badge>
        <span>
          {t("admin.backup_size", {
            size: formatNumber(backup.sizeMb, locale),
          })}
        </span>
      </div>
    </article>
  )
}
