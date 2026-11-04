import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SelectInput } from "@/components/app/select-input"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { useAppForm } from "@/hooks/use-app-form"
import { useT } from "@/lib/i18n/use-t"
import { promotionTypeSchema } from "@sayaratak/shared/schemas/listing"
import { grantSchema, type GrantForm } from "@/features/admin/schemas"

// Promotion type and, for Featured, length in days. The caller closes the dialog when its mutation settles.
export function GrantPromotionDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
  onConfirm: (value: GrantForm) => void
}) {
  const { t } = useT()
  const form = useAppForm<GrantForm>({
    resolver: zodResolver(grantSchema),
    mode: "onTouched",
    defaultValues: { type: "featured", days: 7 },
  })
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])
  const { errors } = form.formState
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.grant_title")}
      description={t("admin.grant_body")}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(onConfirm)}
      >
        <FormField label={t("admin.grant_type")} error={errors.type?.message}>
          {(control) => (
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <SelectInput
                  {...control}
                  value={field.value}
                  onChange={(next) =>
                    field.onChange(promotionTypeSchema.parse(next))
                  }
                  options={promotionTypeSchema.options.map((v) => ({
                    value: v,
                    label: t(`promotion.name_${v}`),
                  }))}
                />
              )}
            />
          )}
        </FormField>
        {form.watch("type") === "featured" && (
          <FormField
            label={t("admin.grant_days")}
            error={errors.days?.message}
            className="w-40"
          >
            {(control) => (
              <Controller
                control={form.control}
                name="days"
                render={({ field }) => (
                  <NumberField
                    {...control}
                    min={1}
                    max={365}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </FormField>
        )}
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending}>{t("admin.grant")}</SubmitButton>
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
