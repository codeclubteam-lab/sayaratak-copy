import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SelectInput } from "@/components/app/select-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAppForm } from "@/hooks/use-app-form"
import { useT } from "@/lib/i18n/use-t"
import { banDurations, banSchema, type BanForm } from "../schemas"

// Bans one person: why and for how long. The caller closes the dialog when its mutation settles.
export function BanDialog({
  open,
  onOpenChange,
  name,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  pending?: boolean
  onConfirm: (ban: BanForm) => void
}) {
  const { t } = useT()
  const form = useAppForm<BanForm>({
    resolver: zodResolver(banSchema),
    mode: "onTouched",
    defaultValues: { reason: "", duration: "7d" },
  })
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.ban_title", { name })}
      description={t("admin.ban_body")}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((ban) => onConfirm(ban))}
      >
        <FormField
          label={t("admin.reason")}
          error={form.formState.errors.reason?.message}
        >
          {(control) => (
            <Textarea
              {...control}
              maxLength={300}
              {...form.register("reason")}
            />
          )}
        </FormField>
        <Controller
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormField label={t("admin.ban_duration")}>
              {(control) => (
                <SelectInput
                  {...control}
                  value={field.value}
                  onChange={(next) =>
                    field.onChange(banSchema.shape.duration.parse(next))
                  }
                  options={banDurations.map((value) => ({
                    value,
                    label: t(`admin.ban_${value}`),
                  }))}
                />
              )}
            </FormField>
          )}
        />
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} variant="destructive">
            {t("admin.ban")}
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
