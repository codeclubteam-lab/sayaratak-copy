import { formatDate, formatNumber, formatTime } from "@/lib/format"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { Badge } from "@/components/ui/badge"
import { BackupStatus } from "./backup-status"
import { RestoreButton } from "./restore-button"

export const backupDate = (iso: string, locale: Locale) =>
  `${formatDate(iso, locale)} ${formatTime(iso, locale)}`

// Date, type, size, status and Restore. Newest first from the server, so no column sorts.
export function useBackupColumns(
  onRestore: (backup: Backup) => void,
  busy: boolean
): DataColumn<Backup>[] {
  const { t, locale } = useT()
  return [
    {
      id: "date",
      header: t("admin.backup_col_date"),
      enableHiding: false,
      cell: ({ row }) => backupDate(row.original.createdAt, locale),
    },
    {
      id: "type",
      header: t("admin.backup_col_type"),
      cell: ({ row }) => (
        <Badge variant={row.original.type === "auto" ? "muted" : "primary"}>
          {t(`admin.backup_type_${row.original.type}`)}
        </Badge>
      ),
    },
    {
      id: "size",
      header: t("admin.backup_col_size"),
      meta: { align: "end" },
      cell: ({ row }) =>
        t("admin.backup_size", {
          size: formatNumber(row.original.sizeMb, locale),
        }),
    },
    {
      id: "status",
      header: t("admin.backup_col_status"),
      cell: ({ row }) => <BackupStatus status={row.original.status} />,
    },
    {
      id: "actions",
      header: t("admin.promos_col_actions"),
      enableHiding: false,
      cell: ({ row }) => (
        <RestoreButton
          backup={row.original}
          date={backupDate(row.original.createdAt, locale)}
          busy={busy}
          onRestore={() => onRestore(row.original)}
        />
      ),
    },
  ]
}
