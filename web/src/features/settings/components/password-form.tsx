import { useId, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { PasswordHint } from "@/components/app/password-hint"
import { PasswordInput } from "@/components/app/password-input"
import { PasswordSuggest } from "@/components/app/password-suggest"
import { SubmitButton } from "@/components/app/submit-button"
import { useChangePassword } from "@/features/auth/queries"
import { useT } from "@/lib/i18n/use-t"
import {
  newPasswordFormSchema,
  passwordFormSchema,
  type PasswordForm,
} from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

// Changes the password, or creates one for an account that signed up with Google or Facebook (no current password to ask for).
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useT()
  const hintId = useId()
  // A suggested password shows as text.
  const [shown, setShown] = useState(false)
  const change = useChangePassword()
  const [saved, setSaved] = useState(false)
  const form = useAppForm<PasswordForm>({
    resolver: zodResolver(
      hasPassword ? passwordFormSchema : newPasswordFormSchema
    ),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "" },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit(({ currentPassword, newPassword }) => {
    setSaved(false)
    change.mutate(
      { currentPassword: currentPassword || undefined, newPassword },
      {
        onSuccess: () => {
          form.reset()
          setSaved(true)
        },
        onError: (e) => {
          if (e.code !== "invalid_credentials") return
          form.setError("currentPassword", {
            message: "settings.password_wrong",
          })
          form.setFocus("currentPassword")
        },
      }
    )
  })
  return (
    <form onSubmit={submit} noValidate className="flex max-w-lg flex-col gap-4">
      {hasPassword && (
        <FormField
          label={t("settings.current_password_label")}
          error={errors.currentPassword?.message}
        >
          {(c) => (
            <PasswordInput
              {...c}
              {...form.register("currentPassword")}
              autoComplete="current-password"
            />
          )}
        </FormField>
      )}
      <FormField
        label={t("settings.new_password_label")}
        error={errors.newPassword?.message}
      >
        {(c) => (
          <PasswordInput
            {...c}
            {...form.register("newPassword")}
            shown={shown}
            onShownChange={setShown}
            aria-describedby={[c["aria-describedby"], hintId]
              .filter(Boolean)
              .join(" ")}
            autoComplete="new-password"
          />
        )}
      </FormField>
      <PasswordHint id={hintId} value={form.watch("newPassword")} />
      <PasswordSuggest
        onPick={(value) => {
          form.setValue("newPassword", value, { shouldValidate: true })
          setShown(true)
        }}
      />
      {change.isError && change.error.code !== "invalid_credentials" && (
        <p role="alert" className="text-ui text-destructive">
          {t("settings.password_error")}
        </p>
      )}
      <SubmitButton
        className="self-start"
        pending={change.isPending}
        dirty={form.formState.isDirty}
        savedLabel={saved}
      >
        {t(
          hasPassword ? "settings.password_change" : "settings.password_create"
        )}
      </SubmitButton>
    </form>
  )
}
