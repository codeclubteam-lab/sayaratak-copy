import { useEffect, useRef, useState } from "react"

import { FormField } from "@/components/app/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import {
  useSendOtp,
  useUpdateProfile,
  useVerifyOtp,
} from "@/features/auth/queries"
import { otpFormSchema } from "@/features/auth/schemas"
import { normalizeDigits } from "@sayaratak/shared/lib/digits"
import { useT } from "@/lib/i18n/use-t"
import { useCountdown } from "@/lib/use-countdown"
import type { User } from "@sayaratak/shared/schemas/user"

const COOLDOWN = 30

// A new phone or email is saved only with the code sent to it. The code goes out when the dialog opens; the right code saves the change.
// `existing` confirms a contact the account already has: the code only marks it verified. `sent` skips the first send when the caller already sent the code.
export function VerifyContactDialog({
  field,
  value,
  existing = false,
  sent: alreadySent = false,
  onVerified,
  onCancel,
}: {
  field: "email" | "phone"
  value: string
  existing?: boolean
  sent?: boolean
  onVerified: (user: User) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const send = useSendOtp()
  const update = useUpdateProfile()
  const verify = useVerifyOtp()
  const [code, setCode] = useState("")
  const [errorKey, setErrorKey] = useState<string>()
  const [resendIn, setResendIn] = useCountdown(COOLDOWN)
  const sent = useRef(alreadySent)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    send.mutate({ identifier: value })
  }, [send, value])
  const submit = (raw: string) => {
    const parsed = otpFormSchema.safeParse({ code: normalizeDigits(raw) })
    if (!parsed.success) return setErrorKey(parsed.error.issues[0]?.message)
    const options = {
      onError: (e: { code?: string }) => {
        setCode("")
        setErrorKey(
          e.code === "otp_invalid"
            ? "auth.otp_invalid"
            : e.code === "exists"
              ? "settings.contact_taken"
              : "auth.otp_verify_error"
        )
      },
    }
    if (existing)
      verify.mutate(
        { identifier: value, code: parsed.data.code },
        {
          ...options,
          onSuccess: (r) => ("id" in r ? onVerified(r) : onCancel()),
        }
      )
    else
      update.mutate(
        field === "email"
          ? { email: value, code: parsed.data.code }
          : { phone: value, code: parsed.data.code },
        { ...options, onSuccess: onVerified }
      )
  }
  const taken = send.error?.code === "exists"
  const error = taken
    ? t("settings.contact_taken")
    : errorKey
      ? t(errorKey)
      : send.isError
        ? t("auth.otp_send_error")
        : undefined
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`settings.verify_title_${field}`)}</DialogTitle>
          <DialogDescription>
            {t("settings.verify_body")}{" "}
            <bdi dir="ltr" className="font-medium text-foreground">
              {value}
            </bdi>
          </DialogDescription>
        </DialogHeader>
        {!taken && (
          <FormField label={t("auth.otp_label")} error={error}>
            {(control) => (
              <div dir="ltr">
                <InputOTP
                  {...control}
                  maxLength={6}
                  value={code}
                  onChange={(v) => {
                    setCode(normalizeDigits(v))
                    setErrorKey(undefined)
                  }}
                  onComplete={submit}
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={update.isPending || verify.isPending}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}
          </FormField>
        )}
        {taken && (
          <p role="alert" className="text-ui text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!taken && (
            <Button
              type="button"
              variant="link"
              disabled={resendIn > 0 || send.isPending}
              onClick={() => {
                send.mutate({ identifier: value })
                setResendIn(COOLDOWN)
                setErrorKey(undefined)
              }}
            >
              {resendIn > 0
                ? t("auth.otp_resend_in", { seconds: resendIn })
                : t("auth.otp_resend")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
