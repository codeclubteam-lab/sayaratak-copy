import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { FieldMarks, FormField } from "@/components/app/form-field"
import { NumberField } from "@/components/app/number-field"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SubmitButton } from "@/components/app/submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useAddService, useUpdateService } from "@/features/directory/queries"
import { useAppForm } from "@/hooks/use-app-form"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { serviceFormSchema, type ServiceForm } from "../schemas"

// What the dialog edits: a saved service (with its id) or a new one, blank or filled from a template.
export type ServiceDraft = { id?: string; values: ServiceForm }

function ServiceFormBody({
  draft,
  onDone,
}: {
  draft: ServiceDraft
  onDone: () => void
}) {
  const { t } = useT()
  const add = useAddService()
  const update = useUpdateService()
  const form = useAppForm<ServiceForm>({
    resolver: zodResolver(serviceFormSchema),
    mode: "onTouched",
    defaultValues: draft.values,
  })
  const { errors } = form.formState
  const done = (key: string) => () => {
    toast.add({ title: t(key) })
    onDone()
  }
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  const submit = form.handleSubmit((values) =>
    draft.id
      ? update.mutate(
          { id: draft.id, ...values },
          { onSuccess: done("toast.service_saved"), onError: fail }
        )
      : add.mutate(values, {
          onSuccess: done("toast.service_added"),
          onError: fail,
        })
  )
  const description = form.watch("description") ?? ""
  return (
    <FieldMarks value="required">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormField
          label={t("dashboard.services_name")}
          error={errors.name?.message}
        >
          {(c) => <Input {...c} maxLength={60} {...form.register("name")} />}
        </FormField>
        <FormField
          label={t("dashboard.services_description")}
          error={errors.description?.message}
          description={`${description.length}/300`}
          optional
        >
          {(c) => (
            <Textarea
              {...c}
              maxLength={300}
              rows={3}
              {...form.register("description")}
            />
          )}
        </FormField>
        <Controller
          control={form.control}
          name="priceFrom"
          render={({ field, fieldState }) => (
            <FormField
              label={t("form.service_price")}
              error={fieldState.error?.message}
              optional
            >
              {(c) => (
                <NumberField
                  {...c}
                  grouping
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            </FormField>
          )}
        />
        <p aria-hidden="true" className="text-caption text-muted-foreground">
          {t("form.required_note")}
        </p>
        <div className="flex gap-3">
          <SubmitButton pending={add.isPending || update.isPending}>
            {t("common.save")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onDone}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </FieldMarks>
  )
}

export function ServiceFormDialog({
  draft,
  onClose,
}: {
  draft: ServiceDraft | undefined
  onClose: () => void
}) {
  const { t } = useT()
  return (
    <ResponsiveDialog
      open={!!draft}
      onOpenChange={(open) => !open && onClose()}
      title={t(
        draft?.id
          ? "dashboard.services_edit_title"
          : "dashboard.services_add_title"
      )}
    >
      {draft && <ServiceFormBody draft={draft} onDone={onClose} />}
    </ResponsiveDialog>
  )
}
