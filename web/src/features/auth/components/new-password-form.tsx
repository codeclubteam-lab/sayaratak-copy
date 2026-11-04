import { useId, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { PasswordHint } from "@/components/app/password-hint"
import { PasswordInput } from "@/components/app/password-input"
import { PasswordSuggest } from "@/components/app/password-suggest"
import { SubmitButton } from "@/components/app/submit-button"
import { useEnterKeyHints } from "@/hooks/use-enter-key-hints"
import { useT } from "@/lib/i18n/use-t"
import { useResetPassword } from "../queries"
import { newPasswordFormSchema, type NewPasswordForm } from "../schemas"
import { AuthHeading } from "./auth-heading"
import { useAppForm } from "@/hooks/use-app-form"

// The last step of a reset: the token came from a verified code.
export function NewPasswordForm({
  token,
  onDone,
  onExpired,
}: {
  token: string
  onDone: () => void
  onExpired: () => void
}) {
  const { t } = useT()
  const reset = useResetPassword()
  const hintId = useId()
  // A suggested password shows in both fields.
  const [shown, setShown] = useState(false)
  const root = useRef<HTMLFormElement>(null)
  useEnterKeyHints(root, "done")
  const form = useAppForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordFormSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  })
  const { errors } = form.formState
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title={t("auth.reset_title")}
        helper={t("auth.reset_description")}
      />
      <form
        ref={root}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(({ password }) =>
          reset.mutate(
            { token, password },
            {
              onSuccess: onDone,
              onError: (e) => e.code === "invalid_token" && onExpired(),
            }
          )
        )}
      >
        <div className="flex flex-col gap-2">
          <FormField
            label={t("auth.new_password_label")}
            error={errors.password?.message}
          >
            {(control) => (
              <PasswordInput
                {...control}
                {...form.register("password")}
                shown={shown}
                onShownChange={setShown}
                size="lg"
                autoFocus
                autoComplete="new-password"
                aria-describedby={[control["aria-describedby"], hintId]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
          </FormField>
          <PasswordHint id={hintId} value={form.watch("password")} />
          <PasswordSuggest
            onPick={(value) => {
              form.setValue("password", value, { shouldValidate: true })
              form.setValue("confirmPassword", value, { shouldValidate: true })
              setShown(true)
            }}
          />
        </div>
        <FormField
          label={t("auth.confirm_password_label")}
          error={errors.confirmPassword?.message}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.register("confirmPassword")}
              shown={shown}
              onShownChange={setShown}
              size="lg"
              autoComplete="new-password"
            />
          )}
        </FormField>
        {reset.isError && reset.error.code !== "invalid_token" && (
          <p role="alert" className="text-ui text-destructive">
            {t("auth.reset_error")}
          </p>
        )}
        <SubmitButton size="lg" pending={reset.isPending}>
          {t("auth.reset_submit")}
        </SubmitButton>
      </form>
    </div>
  )
}
