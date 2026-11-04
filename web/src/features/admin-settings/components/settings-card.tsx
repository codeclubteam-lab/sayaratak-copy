import { useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form"
import type { z } from "zod"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { useUpdateSettings } from "@/features/admin/queries"
import type { Settings } from "@sayaratak/shared/schemas/admin"
import { LeaveGuard } from "@/components/app/leave-guard"
import { SettingsSection } from "@/components/app/settings-section"
import { SubmitButton } from "@/components/app/submit-button"
import { useAppForm } from "@/hooks/use-app-form"

// One settings section: its own form and Save button. Saving sends only this section's fields; `toBody` maps the form to the settings patch.
export function SettingsCard<T extends FieldValues>({
  title,
  description,
  schema,
  values,
  toBody,
  children,
}: {
  title: string
  description: string
  schema: z.ZodType<T, T>
  values: DefaultValues<T>
  toBody: (values: T) => Partial<Settings>
  children: (form: UseFormReturn<T, unknown, T>) => ReactNode
}) {
  const { t } = useT()
  const update = useUpdateSettings()
  const [saved, setSaved] = useState(false)
  const form = useAppForm<T, unknown, T>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: values,
  })
  const { isDirty } = form.formState
  const submit = form.handleSubmit((next) => {
    setSaved(false)
    update.mutate(toBody(next), {
      onSuccess: () => {
        form.reset(next)
        setSaved(true)
      },
    })
  })
  return (
    <SettingsSection title={title} description={description}>
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={submit}
          className="flex max-w-2xl flex-col gap-4"
        >
          {children(form)}
          {update.isError && (
            <p role="alert" className="text-ui text-destructive">
              {errorText(t, update.error)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              pending={update.isPending}
              dirty={isDirty}
              savedLabel={saved}
            >
              {t("common.save")}
            </SubmitButton>
            {isDirty && (
              <span
                role="status"
                className="text-caption text-muted-foreground"
              >
                {t("dashboard.profile_unsaved")}
              </span>
            )}
          </div>
        </form>
      </FormProvider>
      <LeaveGuard when={isDirty && !update.isPending} />
    </SettingsSection>
  )
}
