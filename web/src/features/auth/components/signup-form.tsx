import { useId, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller } from "react-hook-form"

import { FieldError } from "@/components/app/field-error"
import { FormField } from "@/components/app/form-field"
import { PasswordHint } from "@/components/app/password-hint"
import { PasswordInput } from "@/components/app/password-input"
import { PasswordSuggest } from "@/components/app/password-suggest"
import { ShellLink } from "@/components/app/shell-link"
import { SubmitButton } from "@/components/app/submit-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEnterKeyHints } from "@/hooks/use-enter-key-hints"
import type { ApiError } from "@/lib/api/client"
import { useT } from "@/lib/i18n/use-t"
import { signupFormSchema, type SignupForm as Values } from "../schemas"
import { useAppForm } from "@/hooks/use-app-form"

const linkClass = "font-medium text-primary underline"

export function SignupForm({
  values,
  autoFocus,
  pending,
  error,
  onSubmit,
}: {
  // What was typed before, when the person comes back from the code step to fix the email.
  values: Values
  autoFocus: boolean
  pending: boolean
  error: ApiError | null
  onSubmit: (values: Values) => void
}) {
  const { t } = useT()
  const hintId = useId()
  // A suggested password shows in both fields.
  const [shown, setShown] = useState(false)
  const termsId = useId()
  const root = useRef<HTMLFormElement>(null)
  useEnterKeyHints(root, "done")
  const form = useAppForm<Values>({
    resolver: zodResolver(signupFormSchema),
    mode: "onTouched",
    defaultValues: values,
  })
  const { errors } = form.formState
  const describe = (id: string | undefined) =>
    [id, hintId].filter(Boolean).join(" ")
  return (
    <form
      ref={root}
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormField
        label={t("auth.full_name_label")}
        error={errors.fullName?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register("fullName")}
            size="lg"
            autoFocus={autoFocus}
            autoComplete="name"
          />
        )}
      </FormField>
      <FormField label={t("auth.email_label")} error={errors.email?.message}>
        {(control) => (
          <Input
            {...control}
            {...form.register("email")}
            type="email"
            size="lg"
            autoComplete="email"
            dir="ltr"
          />
        )}
      </FormField>
      <div className="flex flex-col gap-2">
        <FormField
          label={t("auth.password_label")}
          error={errors.password?.message}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.register("password")}
              shown={shown}
              onShownChange={setShown}
              size="lg"
              autoComplete="new-password"
              aria-describedby={describe(control["aria-describedby"])}
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
      <Controller
        control={form.control}
        name="terms"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-1">
            <Label className="min-h-(--row-h) font-normal">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                inputRef={field.ref}
                aria-invalid={Boolean(fieldState.error)}
                aria-describedby={fieldState.error ? termsId : undefined}
              />
              <span>
                {t("auth.terms_agree")}{" "}
                <ShellLink path="/terms" className={linkClass} newTab>
                  {t("nav.terms")}
                </ShellLink>{" "}
                {t("auth.terms_and")}{" "}
                <ShellLink path="/privacy" className={linkClass} newTab>
                  {t("nav.privacy")}
                </ShellLink>
              </span>
            </Label>
            <FieldError id={termsId} message={fieldState.error?.message} />
          </div>
        )}
      />
      {error && (
        <p role="alert" className="text-ui text-destructive">
          {error.code === "exists"
            ? t("auth.account_exists")
            : t("auth.register_error")}
        </p>
      )}
      <SubmitButton size="lg" pending={pending}>
        {t("auth.create_account")}
      </SubmitButton>
    </form>
  )
}
