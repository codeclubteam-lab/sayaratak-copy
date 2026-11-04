import { useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormField } from "@/components/app/form-field"
import { ShellLink } from "@/components/app/shell-link"
import { SubmitButton } from "@/components/app/submit-button"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEnterKeyHints } from "@/hooks/use-enter-key-hints"
import { useT } from "@/lib/i18n/use-t"
import { useForgotPassword, useVerifyReset } from "../queries"
import { emailFormSchema, type EmailForm } from "../schemas"
import { AuthHeading } from "./auth-heading"
import { CodeStep } from "./code-step"
import { NewPasswordForm } from "./new-password-form"
import { SuccessStep } from "./success-step"
import { useAppForm } from "@/hooks/use-app-form"

const linkClass =
  "inline-flex min-h-11 items-center justify-center text-ui font-medium text-primary md:min-h-10"

// Email, then the emailed code, then a new password, then "Password changed".
export function ForgotFlow() {
  const { t } = useT()
  const forgot = useForgotPassword()
  const verify = useVerifyReset()
  const [step, setStep] = useState<"email" | "code" | "password" | "done">(
    "email"
  )
  const [email, setEmail] = useState("")
  const root = useRef<HTMLFormElement>(null)
  useEnterKeyHints(root, "done")
  const form = useAppForm<EmailForm>({
    resolver: zodResolver(emailFormSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  })
  const send = (value: string) =>
    forgot.mutate(
      { email: value },
      {
        onSuccess: () => {
          setEmail(value)
          setStep("code")
        },
      }
    )
  const restart = () => {
    forgot.reset()
    verify.reset()
    setStep("email")
  }

  if (step === "done")
    return (
      <SuccessStep
        title={t("auth.password_changed_title")}
        text={t("auth.password_changed_text")}
      >
        <ShellLink
          path="/auth/login"
          className={buttonVariants({ size: "lg" })}
        >
          {t("auth.login_submit")}
        </ShellLink>
      </SuccessStep>
    )
  if (step === "password" && verify.data)
    return (
      <NewPasswordForm
        token={verify.data.token}
        onDone={() => setStep("done")}
        onExpired={restart}
      />
    )
  if (step === "code")
    return (
      <CodeStep
        email={email}
        demoCode={forgot.data?.demoCode}
        verifying={verify.isPending}
        error={verify.error}
        onVerify={(code) =>
          verify.mutate(
            { email, code },
            { onSuccess: () => setStep("password") }
          )
        }
        resending={forgot.isPending}
        resendFailed={forgot.isError}
        onResend={() => {
          verify.reset()
          send(email)
        }}
        onBack={restart}
      />
    )
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title={t("auth.forgot_title")}
        helper={t("auth.forgot_description")}
      />
      <form
        ref={root}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((v) => send(v.email))}
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
              autoFocus
              autoComplete="username"
              dir="ltr"
            />
          )}
        </FormField>
        {forgot.isError && (
          <p role="alert" className="text-ui text-destructive">
            {t("auth.forgot_error")}
          </p>
        )}
        <SubmitButton size="lg" pending={forgot.isPending}>
          {t("auth.forgot_submit")}
        </SubmitButton>
      </form>
      <ShellLink path="/auth/login" className={linkClass}>
        {t("auth.back_to_sign_in")}
      </ShellLink>
    </div>
  )
}
