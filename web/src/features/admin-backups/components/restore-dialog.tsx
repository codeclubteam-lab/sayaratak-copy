import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheckIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import type { Backup } from "@sayaratak/shared/schemas/admin"
import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppForm } from "@/hooks/use-app-form"
import { restoreConfirmSchema, type RestoreConfirm } from "../schemas"
import { RestoreProgress } from "./restore-progress"
import { backupDate } from "./use-backup-columns"

// Says what goes back and asks for the typed word, then keeps that text with a progress bar under it (so the size
// holds), then the result. While it restores only Close shuts it, leaving the restore running: no X, and Escape or a
// click outside does nothing.
export function RestoreDialog({
  backup,
  pending,
  done,
  error,
  onConfirm,
  onClose,
}: {
  backup: Backup | undefined
  pending: boolean
  done: boolean
  error: string | undefined
  onConfirm: (backup: Backup) => void
  onClose: () => void
}) {
  const { t, locale } = useT()
  const phrase = t("admin.backup_restore_phrase")
  const form = useAppForm<RestoreConfirm>({
    resolver: zodResolver(restoreConfirmSchema(phrase)),
    mode: "onSubmit",
    defaultValues: { phrase: "" },
  })
  const date = backup ? backupDate(backup.createdAt, locale) : ""
  return (
    <ResponsiveDialog
      open={!!backup}
      onOpenChange={(open) => !open && !pending && onClose()}
      title={t(
        done ? "admin.backup_restored_title" : "admin.backup_restore_title"
      )}
      closable={!done && !pending}
    >
      {done ? (
        <div role="status" className="flex flex-col items-start gap-4">
          <p className="flex items-start gap-2 text-body">
            <CircleCheckIcon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-success"
            />
            {t("admin.backup_restored", { date })}
          </p>
          <Button type="button" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      ) : pending ? (
        <div className="flex flex-col items-stretch gap-4">
          <p className="text-body text-muted-foreground">
            {t("admin.backup_restore_body", { date })}
          </p>
          <RestoreProgress />
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={onClose}
          >
            {t("common.close")}
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(() => {
            if (backup) onConfirm(backup)
          })}
        >
          <p className="text-body text-muted-foreground">
            {t("admin.backup_restore_body", { date })}
          </p>
          <FormField
            label={t("admin.backup_restore_type", { phrase })}
            error={form.formState.errors.phrase?.message}
          >
            {(props) => (
              <Input
                {...props}
                autoComplete="off"
                spellCheck={false}
                {...form.register("phrase")}
              />
            )}
          </FormField>
          {error && (
            <p role="alert" className="text-ui text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <SubmitButton variant="destructive">
              {t("admin.backup_restore")}
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  )
}
