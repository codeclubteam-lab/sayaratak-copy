import { useContext, useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { PasswordInput } from "@/components/app/password-input"
import { ShellLink } from "@/components/app/shell-link"
import { SubmitButton } from "@/components/app/submit-button"
import { Input } from "@/components/ui/input"
import { useEnterKeyHints } from "@/hooks/use-enter-key-hints"
import { useT } from "@/lib/i18n/use-t"
import { useCountdown } from "@/lib/use-countdown"
import { closeAuthGate } from "../auth-gate"
import { useLogin } from "../queries"
import { loginFormSchema, type LoginForm as Values } from "../schemas"
import { AuthHeading, AuthMode } from "./auth-heading"
import { AuthSwitch, type AuthSwitchTarget } from "./auth-switch"
import { DemoAccounts } from "./demo-accounts"
import { SocialSignIn } from "./social-sign-in"
import { useAppForm } from "@/hooks/use-app-form"
import { AdminCodeStep } from "./admin-code-step"
import { SessionStep } from "./session-step"

const linkClass =
  "inline-flex min-h-11 items-center text-ui font-medium text-primary md:min-h-10"

// Email and password on one screen, so a password manager fills both at once.
export function LoginForm({
  onDone,
  reason,
  autoFocus,
  ...target
}: AuthSwitchTarget & {
  onDone: () => void
  // A gated action's "Sign in to save this listing", in place of the usual help.
  reason?: string
  autoFocus?: boolean
}) {
  const { t } = useT()
  const mode = useContext(AuthMode)
  const login = useLogin()
  const [adminEmail, setAdminEmail] = useState<string>()
  const [lockedFor, setLockedFor] = useCountdown(0)
  const root = useRef<HTMLFormElement>(null)
  useEnterKeyHints(root, "done")
  const form = useAppForm<Values>({
    resolver: zodResolver(loginFormSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  })
  const code = login.error?.code
  const locked = lockedFor > 0
  const submit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (result) => {
        if ("twoFactorRedirect" in result) setAdminEmail(values.email)
        else onDone()
      },
      onError: (e) => {
        if (e.code === "invalid_credentials") {
          form.resetField("password")
          form.setFocus("password")
        }
        if (e.code === "too_many_attempts") setLockedFor(e.retryAfter ?? 60)
      },
    })
  )
  const message = locked
    ? t("auth.too_many_attempts", { seconds: lockedFor })
    : code === "invalid_credentials"
      ? t("auth.invalid_credentials")
      : code === "banned"
        ? t("auth.account_suspended")
        : code === "email_not_verified"
          ? t("auth.email_not_verified")
          : code && code !== "too_many_attempts"
            ? t("auth.login_error")
            : undefined
  if (login.authenticated)
    return (
      <SessionStep
        pending={login.session.isPending}
        error={login.session.isError}
        onRetry={() => login.session.mutate(undefined, { onSuccess: onDone })}
        onBack={() => {
          login.reset()
          form.resetField("password")
        }}
      />
    )
  if (adminEmail)
    return (
      <AdminCodeStep
        email={adminEmail}
        onDone={onDone}
        onBack={() => {
          setAdminEmail(undefined)
          login.reset()
          form.resetField("password")
        }}
      />
    )
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title={t("auth.login_title")}
        helper={reason ? t(reason) : t("auth.login_helper")}
      />
      <form
        ref={root}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={submit}
      >
        <FormField
          label={t("auth.email_label")}
          error={form.formState.errors.email?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...form.register("email")}
              type="email"
              size="lg"
              autoFocus={autoFocus ?? mode === "page"}
              autoComplete="username"
              dir="ltr"
            />
          )}
        </FormField>
        <div className="flex flex-col">
          <FormField
            label={t("auth.password_label")}
            error={form.formState.errors.password?.message}
          >
            {(control) => (
              <PasswordInput
                {...control}
                {...form.register("password")}
                size="lg"
                autoComplete="current-password"
                disabled={locked}
              />
            )}
          </FormField>
          <ShellLink
            path="/auth/forgot"
            className={`${linkClass} self-end`}
            onClick={mode === "dialog" ? closeAuthGate : undefined}
          >
            {t("auth.forgot_password")}
          </ShellLink>
        </div>
        {message && (
          <p role="alert" className="text-ui text-destructive">
            {message}{" "}
            {code === "banned" && (
              <ShellLink path="/contact" className={linkClass}>
                {t("auth.contact_support")}
              </ShellLink>
            )}
          </p>
        )}
        <SubmitButton size="lg" pending={login.isPending} disabled={locked}>
          {t("auth.login_submit")}
        </SubmitButton>
      </form>
      <SocialSignIn redirect={target.redirect} />
      <AuthSwitch
        {...target}
        text={t("auth.no_account")}
        label={t("auth.create_account")}
        path="/auth/signup"
      />
      <DemoAccounts onDone={onDone} onAdminChallenge={setAdminEmail} />
    </div>
  )
}
