import { useEffect, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  FormProvider,
  type DefaultValues,
  type FieldValues,
} from "react-hook-form"
import type { z } from "zod"

import { SettingsSection } from "@/components/app/settings-section"
import { SubmitButton } from "@/components/app/submit-button"
import { useUpdateBusiness } from "@/features/directory/queries"
import { useAppForm } from "@/hooks/use-app-form"
import { useT } from "@/lib/i18n/use-t"

// One profile section: its own form, Save button and "Unsaved changes" note. Saving sends only this section's fields.
export function SectionForm<T extends FieldValues>({
  id,
  title,
  description,
  schema,
  values,
  toBody = (v) => v,
  onDirty,
  children,
}: {
  id: string
  title: string
  description?: string
  schema: z.ZodType<T, T>
  values: DefaultValues<T>
  toBody?: (values: T) => Record<string, unknown>
  onDirty: (id: string, dirty: boolean) => void
  children: ReactNode
}) {
  const { t } = useT()
  const update = useUpdateBusiness()
  const [saved, setSaved] = useState(false)
  const form = useAppForm<T, unknown, T>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: values,
  })
  const dirty = form.formState.isDirty
  useEffect(() => onDirty(id, dirty), [id, dirty, onDirty])
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
          onSubmit={submit}
          noValidate
          className="flex max-w-2xl flex-col gap-4"
        >
          {children}
          {update.isError && (
            <p role="alert" className="text-ui text-destructive">
              {t("settings.save_error")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton
              pending={update.isPending}
              dirty={dirty}
              savedLabel={saved}
            >
              {t("common.save")}
            </SubmitButton>
            {dirty && (
              <span className="text-caption text-muted-foreground">
                {t("dashboard.profile_unsaved")}
              </span>
            )}
          </div>
        </form>
      </FormProvider>
    </SettingsSection>
  )
}
