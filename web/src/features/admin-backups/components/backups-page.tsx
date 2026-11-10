import { DatabaseBackupIcon, InfoIcon } from "lucide-react"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useCreateBackup } from "@/features/admin/queries"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { SubmitButton } from "@/components/app/submit-button"
import { toast } from "@/components/ui/toast"
import { BackupsTable } from "./backups-table"
import { ScheduleCard } from "./schedule-card"

const RESTORE_CMD = "bun run db:restore <id>"

// The automatic schedule, Back up now, terminal restore note, and every backup.
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
      <section
        aria-labelledby="backup-restore-note-title"
        className="flex items-start gap-3 rounded-xl bg-card p-4"
      >
        <InfoIcon
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <h2 id="backup-restore-note-title" className="text-ui font-medium">
            {t("admin.backups_restore_note_title")}
          </h2>
          <p className="text-ui text-muted-foreground">
            {t("admin.backups_restore_note_body")}
          </p>
          <code
            dir="ltr"
            className="mt-1 max-w-full overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-ui"
          >
            {RESTORE_CMD}
          </code>
        </div>
      </section>
      <BackupsTable />
    </div>
  )
}
