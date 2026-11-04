import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArchiveIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { adminQueries, useRestoreBackup } from "@/features/admin/queries"
import { DataTable } from "@/components/app/data-table"
import { EmptyState } from "@/components/app/empty-state"
import { toast } from "@/components/ui/toast"
import { BackupCard } from "./backup-card"
import { RestoreDialog } from "./restore-dialog"
import { useBackupColumns } from "./use-backup-columns"

// Newest first, on one page. While a backup runs the list refetches every second, so it turns Ready without a reload.
// The restore lives here, not in the dialog, so closing the dialog leaves it running; the result then comes as a toast.
export function BackupsTable() {
  const { t } = useT()
  const backups = useQuery({
    ...adminQueries.backups,
    refetchInterval: (q) =>
      q.state.data?.some((b) => b.status === "running") ? 1000 : false,
  })
  const restore = useRestoreBackup()
  const [open, setOpen] = useState<Backup>()
  // Whether the dialog is still showing the restore it started.
  const watching = useRef(false)
  const restoringId = restore.isPending ? restore.variables : undefined
  const rows = backups.data?.map((b) =>
    b.id === restoringId ? { ...b, status: "restoring" as const } : b
  )
  const show = (b: Backup) => {
    restore.reset()
    setOpen(b)
  }
  const close = () => {
    watching.current = false
    setOpen(undefined)
  }
  const start = (b: Backup) => {
    watching.current = true
    restore.mutate(b.id, {
      onSuccess: () =>
        !watching.current &&
        toast.add({ title: t("admin.backup_restored_title") }),
      onError: (e) =>
        !watching.current && toast.add({ title: errorText(t, e) }),
    })
  }
  const busy = restore.isPending
  const columns = useBackupColumns(show, busy)
  const mine = restore.variables === open?.id
  return (
    <section aria-labelledby="backups-title" className="flex flex-col gap-3">
      <h2 id="backups-title" className="text-title font-semibold">
        {t("admin.backups_table")}
      </h2>
      <DataTable
        label={t("admin.backups_table")}
        columns={columns}
        data={rows}
        getRowId={(b) => b.id}
        loading={backups.isPending}
        error={backups.isError}
        onRetry={() => void backups.refetch()}
        mobileCard={(b) => (
          <BackupCard backup={b} busy={busy} onRestore={() => show(b)} />
        )}
        empty={
          <EmptyState
            icon={ArchiveIcon}
            title={t("admin.backups_empty")}
            body={t("admin.backups_empty_body")}
          />
        }
        page={1}
        pageCount={1}
        hrefFor={() => ""}
        onPageChange={() => undefined}
      />
      <RestoreDialog
        key={open?.id}
        backup={open}
        pending={mine && restore.isPending}
        done={mine && restore.isSuccess}
        error={
          mine && restore.isError ? errorText(t, restore.error) : undefined
        }
        onConfirm={start}
        onClose={close}
      />
    </section>
  )
}
