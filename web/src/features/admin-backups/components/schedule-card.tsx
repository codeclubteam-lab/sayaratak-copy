import { useQuery } from "@tanstack/react-query"

import { errorText } from "@/lib/api/error-text"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { settingsSchema } from "@sayaratak/shared/schemas/admin"
import { adminQueries, useUpdateSettings } from "@/features/admin/queries"
import { FormField } from "@/components/app/form-field"
import { SectionError } from "@/components/app/section-error"
import { SelectInput } from "@/components/app/select-input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"

const schedule = settingsSchema.shape.backupSchedule

// Picking a schedule saves at once; the field shows the pick while it saves.
export function ScheduleCard() {
  const { t, locale } = useT()
  const settings = useQuery(adminQueries.settings)
  const backups = useQuery(adminQueries.backups)
  const update = useUpdateSettings()
  const last = backups.data?.find((b) => b.type === "auto")
  if (settings.isError)
    return (
      <SectionError
        title={t("admin.backups_schedule")}
        message={t("admin.plans_settings_error")}
        onRetry={() => void settings.refetch()}
      />
    )
  if (!settings.data)
    return <Skeleton aria-hidden="true" className="h-28 rounded-xl" />
  const value = update.isPending
    ? (update.variables.backupSchedule ?? settings.data.backupSchedule)
    : settings.data.backupSchedule
  return (
    <div className="rounded-xl bg-card p-4">
      <FormField
        className="max-w-xs"
        label={t("admin.backups_schedule")}
        description={
          last
            ? t("admin.backups_last_auto", {
                date: formatDate(last.createdAt, locale),
              })
            : t("admin.backups_no_auto")
        }
      >
        {(props) => (
          <SelectInput
            {...props}
            value={value}
            options={schedule.options.map((v) => ({
              value: v,
              label: t(`admin.backups_schedule_${v}`),
            }))}
            onChange={(next) =>
              update.mutate(
                { backupSchedule: schedule.parse(next) },
                {
                  onSuccess: () =>
                    toast.add({ title: t("admin.backups_schedule_saved") }),
                  onError: (e) => toast.add({ title: errorText(t, e) }),
                }
              )
            }
          />
        )}
      </FormField>
    </div>
  )
}
