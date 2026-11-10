import { formatDate, formatNumber, formatTime } from "@/lib/format"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { useT } from "@/lib/i18n/use-t"
import type { DataColumn } from "@/lib/table"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { CopyButton } from "@/components/app/copy-button"
import { Badge } from "@/components/ui/badge"
import { BackupStatus } from "./backup-status"

export const backupDate = (iso: string, locale: Locale) =>
  `${formatDate(iso, locale)} ${formatTime(iso, locale)}`

export function BackupId({ id }: { id: string }) {
  const { t } = useT()
  return (
    <span className="inline-flex items-center gap-1">
      <bdi dir="ltr" className="font-mono text-ui">
        {id}
      </bdi>
      <CopyButton value={id} label={t("admin.backup_copy_id", { id })} />
    </span>
  )
}

// ID, date, type, size and status. Newest first from the server, so no column sorts.
export function useBackupColumns(): DataColumn<Backup>[] {
  const { t, locale } = useT()
  return [
    {
      id: "id",
      header: t("admin.backup_col_id"),
      enableHiding: false,
      cell: ({ row }) => <BackupId id={row.original.id} />,
    },
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
  ]
}
