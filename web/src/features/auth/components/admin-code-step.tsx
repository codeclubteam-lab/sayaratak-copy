import { useEffect, useRef } from "react"

import { useT } from "@/lib/i18n/use-t"
import { useSendAdminCode, useVerifyAdminCode } from "../queries"
import { CodeStep } from "./code-step"
import { SessionStep } from "./session-step"

export function AdminCodeStep({
  email,
  onDone,
  onBack,
}: {
  email: string
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useT()
  const send = useSendAdminCode()
  const verify = useVerifyAdminCode()
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    send.mutate()
  }, [send])
  if (verify.authenticated)
    return (
      <SessionStep
        pending={verify.session.isPending}
        error={verify.session.isError}
        onRetry={() => verify.session.mutate(undefined, { onSuccess: onDone })}
        onBack={onBack}
      />
    )
  return (
    <CodeStep
      email={email}
      title={t("auth.admin_code_title")}
      helper={t("auth.admin_code_helper")}
      backLabel={t("auth.back_to_sign_in")}
      verifying={verify.isPending || send.isPending}
      error={verify.error}
      onVerify={(code) => verify.mutate(code, { onSuccess: onDone })}
      resending={send.isPending}
      resendFailed={send.isError}
      resendError={send.error}
      onResend={() => {
        verify.reset()
        send.mutate()
      }}
      onBack={onBack}
    />
  )
}
