import { useContext, useState } from "react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { useSignup, useResendSignup, useVerifySignup } from "../queries"
import type { SignupForm as Values } from "../schemas"
import { AuthHeading, AuthMode } from "./auth-heading"
import { AuthSwitch, type AuthSwitchTarget } from "./auth-switch"
import { CodeStep } from "./code-step"
import { SignupForm } from "./signup-form"
import { SocialSignIn } from "./social-sign-in"
import { SuccessStep } from "./success-step"
import { SessionStep } from "./session-step"

const empty: Values = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  terms: false,
}

// Better-Auth creates an unverified account first. Only the verified code signs it in.
export function SignupFlow({
  onDone,
  autoFocus,
  ...login
}: AuthSwitchTarget & { onDone: () => void; autoFocus?: boolean }) {
  const { t } = useT()
  const mode = useContext(AuthMode)
  const signup = useSignup()
  const verify = useVerifySignup()
  const resend = useResendSignup()
  const [step, setStep] = useState<"form" | "code" | "done">("form")
  const [values, setValues] = useState(empty)
  const send = (v: Values) =>
    signup.mutate(
      { fullName: v.fullName, email: v.email, password: v.password },
      {
        onSuccess: () => {
          setValues(v)
          setStep("code")
        },
      }
    )

  if (step === "done")
    return (
      <SuccessStep
        title={t("auth.verified_title")}
        text={t("auth.verified_text")}
      >
        <Button type="button" size="lg" onClick={onDone}>
          {t("common.continue")}
        </Button>
      </SuccessStep>
    )
  if (step === "code" && verify.authenticated)
    return (
      <SessionStep
        pending={verify.session.isPending}
        error={verify.session.isError}
        onRetry={() =>
          verify.session.mutate(undefined, { onSuccess: () => setStep("done") })
        }
        onBack={() => {
          verify.reset()
          setStep("form")
        }}
      />
    )
  if (step === "code")
    return (
      <CodeStep
        email={values.email}
        verifying={verify.isPending}
        error={verify.error}
        onVerify={(code) =>
          verify.mutate(
            { email: values.email, code },
            { onSuccess: () => setStep("done") }
          )
        }
        resending={resend.isPending}
        resendFailed={resend.isError}
        resendError={resend.error}
        onResend={() => {
          verify.reset()
          resend.mutate(values.email)
        }}
        onBack={() => {
          signup.reset()
          verify.reset()
          resend.reset()
          setStep("form")
        }}
      />
    )
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        title={t("auth.signup_title")}
        helper={t("auth.signup_helper")}
      />
      <SignupForm
        values={values}
        autoFocus={autoFocus ?? mode === "page"}
        pending={signup.isPending}
        error={signup.error}
        onSubmit={send}
      />
      <SocialSignIn redirect={login.redirect} />
      <AuthSwitch
        {...login}
        text={t("auth.have_account")}
        label={t("auth.login_submit")}
        path="/auth/login"
      />
    </div>
  )
}
