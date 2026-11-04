import { useContext, useState } from "react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { useSignup, useVerifySignup } from "../queries"
import type { SignupForm as Values } from "../schemas"
import { AuthHeading, AuthMode } from "./auth-heading"
import { AuthSwitch, type AuthSwitchTarget } from "./auth-switch"
import { CodeStep } from "./code-step"
import { SignupForm } from "./signup-form"
import { SocialSignIn } from "./social-sign-in"
import { SuccessStep } from "./success-step"

const empty: Values = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  terms: false,
}

// Form, then the emailed code, then "Email verified". The account exists only once the code is right.
export function SignupFlow({
  onDone,
  autoFocus,
  ...login
}: AuthSwitchTarget & { onDone: () => void; autoFocus?: boolean }) {
  const { t } = useT()
  const mode = useContext(AuthMode)
  const signup = useSignup()
  const verify = useVerifySignup()
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
  if (step === "code")
    return (
      <CodeStep
        email={values.email}
        demoCode={signup.data?.demoCode}
        verifying={verify.isPending}
        error={verify.error}
        onVerify={(code) =>
          verify.mutate(
            { email: values.email, code },
            { onSuccess: () => setStep("done") }
          )
        }
        resending={signup.isPending}
        resendFailed={signup.isError}
        onResend={() => {
          verify.reset()
          send(values)
        }}
        onBack={() => {
          signup.reset()
          verify.reset()
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
      <SocialSignIn onDone={onDone} />
      <AuthSwitch
        {...login}
        text={t("auth.have_account")}
        label={t("auth.login_submit")}
        path="/auth/login"
      />
    </div>
  )
}
