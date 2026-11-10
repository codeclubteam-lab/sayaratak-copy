import { useQuery } from "@tanstack/react-query"
import { ArchiveIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { adminQueries } from "@/features/admin/queries"
import { DataTable } from "@/components/app/data-table"
import { EmptyState } from "@/components/app/empty-state"
import { BackupCard } from "./backup-card"
import { useBackupColumns } from "./use-backup-columns"

// Newest first, on one page. While a backup runs the list refetches every second, so it turns Ready without a reload.
export function BackupsTable() {
  const { t } = useT()
  const backups = useQuery({
    ...adminQueries.backups,
    refetchInterval: (q) =>
      q.state.data?.some((b) => b.status === "running") ? 1000 : false,
  })
  const columns = useBackupColumns()
  return (
    <section aria-labelledby="backups-title" className="flex flex-col gap-3">
      <h2 id="backups-title" className="text-title font-semibold">
        {t("admin.backups_table")}
      </h2>
      <DataTable
        label={t("admin.backups_table")}
        columns={columns}
        data={backups.data}
        getRowId={(b) => b.id}
        loading={backups.isPending}
        error={backups.isError}
        onRetry={() => void backups.refetch()}
        mobileCard={(b) => <BackupCard backup={b} />}
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
    </section>
  )
}
