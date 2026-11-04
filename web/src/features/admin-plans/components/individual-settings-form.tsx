import { useId } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import type { Settings } from "@sayaratak/shared/schemas/admin"
import { useUpdateSettings } from "@/features/admin/queries"
import { FieldError } from "@/components/app/field-error"
import { LeaveGuard } from "@/components/app/leave-guard"
import { NumberField } from "@/components/app/number-field"
import { SubmitButton } from "@/components/app/submit-button"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { useAppForm } from "@/hooks/use-app-form"
import {
  individualSettingsSchema,
  type IndividualSettingsForm as Values,
} from "../schemas"

const row = "flex items-center gap-4 border-t py-3"

// A settings list: each row has its label and hint at the start and its control at the end; Save sits in the footer and saves both. Until then the footer says so and leaving the page asks first. Turning subscriptions off takes the limit meter off every individual's dashboard; the free limit is also what the Free plan shows.
export function IndividualSettingsForm({ settings }: { settings: Settings }) {
  const { t } = useT()
  const id = useId()
  const update = useUpdateSettings()
  const form = useAppForm<Values>({
    resolver: zodResolver(individualSettingsSchema),
    mode: "onTouched",
    defaultValues: {
      individualSubscriptionsEnabled: settings.individualSubscriptionsEnabled,
      freeListingLimit: settings.freeListingLimit,
    },
  })
  const { errors, isDirty } = form.formState
  const limitError = errors.freeListingLimit?.message
  const submit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => toast.add({ title: t("admin.plans_settings_saved") }),
      onError: (e) => toast.add({ title: errorText(t, e) }),
    })
  )
  return (
    <form noValidate onSubmit={submit} className="flex flex-col">
      <div className={row}>
        <div className="flex min-w-0 flex-1 flex-col">
          <span id={`${id}-on`} className="text-ui font-medium">
            {t("admin.plans_individual_on")}
          </span>
          <span
            id={`${id}-on-hint`}
            className="text-caption text-muted-foreground"
          >
            {t("admin.plans_individual_on_hint")}
          </span>
        </div>
        <Controller
          control={form.control}
          name="individualSubscriptionsEnabled"
          render={({ field }) => (
            <Switch
              aria-labelledby={`${id}-on`}
              aria-describedby={`${id}-on-hint`}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
      <div className={row}>
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={`${id}-limit`} className="text-ui font-medium">
            {t("admin.plans_free_limit")}
          </label>
          <span
            id={`${id}-limit-hint`}
            className="text-caption text-muted-foreground"
          >
            {t("admin.plans_free_limit_hint")}
          </span>
          <FieldError id={`${id}-limit-error`} message={limitError} />
        </div>
        <Controller
          control={form.control}
          name="freeListingLimit"
          render={({ field }) => (
            <NumberField
              id={`${id}-limit`}
              aria-invalid={!!limitError}
              aria-describedby={
                limitError
                  ? `${id}-limit-error ${id}-limit-hint`
                  : `${id}-limit-hint`
              }
              className="w-24 shrink-0"
              min={0}
              max={100}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </div>
      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <span role="status" className="text-caption text-muted-foreground">
          {isDirty && t("admin.plans_unsaved")}
        </span>
        <SubmitButton pending={update.isPending}>
          {t("common.save")}
        </SubmitButton>
      </div>
      <LeaveGuard when={isDirty && !update.isPending} />
    </form>
  )
}
