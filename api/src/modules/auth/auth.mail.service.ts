import { db } from "~/shared/db/client"
import { localeOf } from "~/shared/mail/locale"
import { type OtpPurpose, send } from "~/shared/mail/send"

import * as q from "./auth.queries"

/**
 * Mails a Better-Auth code in the person's language: the user row's locale,
 * else the request's Accept-Language, else Arabic (A9). Returns at once; the
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
  const saved = await q.getUserLocale(db, email)
  return saved === "ar" || saved === "en" ? saved : localeOf(request)
}
