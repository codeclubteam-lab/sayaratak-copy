import { DatabaseBackupIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useCreateBackup } from "@/features/admin/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { SubmitButton } from "@/components/app/submit-button"
import { toast } from "@/components/ui/toast"
import { BackupsTable } from "./backups-table"
import { ScheduleCard } from "./schedule-card"

// The automatic schedule, Back up now, and every backup with Restore.
export function BackupsPage() {
  const { t } = useT()
  const title = t("dashboard.nav_backups")
  usePageTitle(title)
  const create = useCreateBackup()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} hint={t("admin.backups_hint")}>
        <SubmitButton
          type="button"
          pending={create.isPending}
          onClick={() =>
            create.mutate(undefined, {
              onSuccess: () => toast.add({ title: t("admin.backup_started") }),
              onError: (e) => toast.add({ title: errorText(t, e) }),
            })
          }
        >
          <DatabaseBackupIcon data-icon="inline-start" />
          {t("admin.backup_now")}
        </SubmitButton>
      </PageHeader>
      <ScheduleCard />
      <BackupsTable />
    </div>
  )
}
