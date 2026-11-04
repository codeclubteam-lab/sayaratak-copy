import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAppForm } from "@/hooks/use-app-form"
import { useT } from "@/lib/i18n/use-t"
import { reasonSchema, type ReasonForm } from "../schemas"

// Asks why before a decision. A quick-pick chip writes its text into the box, which the admin can still edit. The caller closes the dialog when its mutation settles.
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  label,
  confirmLabel,
  chips = [],
  destructive = true,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  confirmLabel: string
  chips?: string[]
  destructive?: boolean
  pending?: boolean
  onConfirm: (reason: string) => void
}) {
  const { t } = useT()
  const form = useAppForm<ReasonForm>({
    resolver: zodResolver(reasonSchema),
    mode: "onTouched",
    defaultValues: { reason: "" },
  })
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])
  const error = form.formState.errors.reason?.message
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(({ reason }) => onConfirm(reason))}
      >
        {chips.length > 0 && (
          <div
            role="group"
            aria-label={t("admin.quick_reasons")}
            className="flex flex-wrap gap-2"
          >
            {chips.map((chip) => (
              <Button
                key={chip}
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("reason", chip, {
                    shouldValidate: !!error,
                    shouldDirty: true,
                  })
                }
              >
                {chip}
              </Button>
            ))}
          </div>
        )}
        <FormField label={label} error={error}>
          {(control) => (
            <Textarea
              {...control}
              maxLength={300}
              {...form.register("reason")}
            />
          )}
        </FormField>
        <div className="flex flex-wrap gap-3">
          <SubmitButton
            pending={pending}
            variant={destructive ? "destructive" : "default"}
          >
            {confirmLabel}
          </SubmitButton>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
