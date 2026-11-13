import { db } from "~/shared/db/client"
import { requestedLocale } from "~/shared/mail/locale"
import { type OtpPurpose, send } from "~/shared/mail/send"

import * as q from "./auth.queries"

/**
 * Request-triggered codes follow Accept-Language, then the saved preference,
 * then Arabic. Returns at once; the
 * lookup and the send run after the answer (A6 "Email not awaited").
 */
export function mailCode(
  mail: { email: string; otp: string; type: OtpPurpose },
  request?: Request
) {
  send.otp({
    to: mail.email,
    code: mail.otp,
    purpose: mail.type,
    locale: localeFor(mail.email, request),
  })
}

async function localeFor(email: string, request?: Request) {
  const requested = requestedLocale(request)
  if (requested) return requested
  const saved = await q.getUserLocale(db, email)
  return saved === "en" ? "en" : "ar"
}
