import { useEffect, useState } from "react"

import { FormField } from "@/components/app/form-field"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import type { ApiError } from "@/lib/api/client"
import { normalizeDigits } from "@sayaratak/shared/lib/digits"
import { useT } from "@/lib/i18n/use-t"
import { useCountdown } from "@/lib/use-countdown"
import { AuthHeading } from "./auth-heading"

const COOLDOWN = 30

const errorKey = (e: ApiError) =>
  e.code === "otp_invalid"
    ? "auth.otp_invalid"
    : e.code === "code_expired"
      ? "auth.code_expired"
      : "auth.otp_verify_error"

// Shared by sign-up, reset and the admin second step. Six digits submit automatically.
export function CodeStep({
  email,
  demoCode,
  verifying,
  error,
  onVerify,
  resending,
  resendFailed,
  onResend,
  onBack,
  title,
  helper,
  backLabel,
  resendError,
}: {
  email: string
  demoCode?: string
  verifying: boolean
  error: ApiError | null
  onVerify: (code: string) => void
  resending: boolean
  resendFailed: boolean
  onResend: () => void
  onBack: () => void
  title?: string
  helper?: string
  backLabel?: string
  resendError?: ApiError | null
}) {
  const { t } = useT()
  const [code, setCode] = useState("")
  const [resendIn, setResendIn] = useCountdown(COOLDOWN)
  const [lockedFor, setLockedFor] = useCountdown(0)
  useEffect(() => {
    if (error) setCode("")
  }, [error])
  useEffect(() => {
    const failure = error ?? resendError
    if (failure?.code === "too_many_attempts")
      setLockedFor(failure.retryAfter ?? 60)
  }, [error, resendError, setLockedFor])
  const message =
    lockedFor > 0
      ? t("auth.too_many_attempts", { seconds: lockedFor })
      : error
        ? t(errorKey(error))
        : resendFailed
          ? t("auth.otp_send_error")
          : undefined
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <AuthHeading
          title={title ?? t("auth.code_title")}
          helper={helper ?? t("auth.code_helper")}
        />
        <p className="flex flex-wrap items-center gap-x-2">
          <bdi dir="ltr" className="text-ui font-medium">
            {email}
          </bdi>
          <Button
            type="button"
            variant="link"
            className="px-0"
            onClick={onBack}
            disabled={verifying}
          >
            {backLabel ?? t("auth.change_email")}
          </Button>
        </p>
      </div>
      <FormField label={t("auth.otp_label")} error={message}>
        {(control) => (
          <div dir="ltr">
            <InputOTP
              {...control}
              maxLength={6}
              value={code}
              onChange={(v) => setCode(normalizeDigits(v))}
              onComplete={onVerify}
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              disabled={verifying || lockedFor > 0}
              containerClassName="w-full"
            >
              <InputOTPGroup className="w-full gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-14 flex-1 rounded-lg border-s text-lead md:text-lead"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}
      </FormField>
      {import.meta.env.VITE_DEMO === "true" && demoCode && (
        <p className="rounded-lg bg-muted px-3 py-2 text-ui">
          {t("auth.code_demo")} <bdi dir="ltr">{demoCode}</bdi>
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={resendIn > 0 || resending || verifying || lockedFor > 0}
        onClick={() => {
          onResend()
          setResendIn(COOLDOWN)
        }}
      >
        {resendIn > 0
          ? t("auth.otp_resend_in", { seconds: resendIn })
          : t("auth.otp_resend")}
      </Button>
    </div>
  )
}
