import nodemailer from "nodemailer"

import { env } from "~/env"
import { log } from "~/shared/log/logger"

import type { RenderedMail } from "./templates"

type Message = RenderedMail & { to: string }

/**
 * The SMTP pool (A9), or null without `SMTP_HOST` (dev logs the code
 * instead). Test mode never builds one: send.ts uses its inbox.
 */
export const transport =
  env.SMTP_HOST && env.NODE_ENV !== "test"
    ? nodemailer.createTransport({
        pool: true,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
      })
    : null

const RECHECK_MS = 60_000
let verified: { ok: boolean; at: number } | undefined

/** Boot check: logs whether SMTP answers; never stops the API (A9). */
export async function verifyTransport() {
  if (!transport) return
  try {
    await transport.verify()
    verified = { ok: true, at: Date.now() }
    log.info("smtp_ready", { host: env.SMTP_HOST })
  } catch (error) {
    verified = { ok: false, at: Date.now() }
    log.error("smtp_unreachable", { host: env.SMTP_HOST, error })
  }
}

/**
 * For `/api/health/ready` (10.4): `off` without an SMTP host, else whether the
 * last check passed. The check repeats once a minute, so a probe every few
 * seconds does not open an SMTP connection each time and a recovered server
 * turns ready again.
 */
export async function smtpStatus(): Promise<"ok" | "failed" | "off"> {
  if (!transport) return "off"
  if (!verified || Date.now() - verified.at > RECHECK_MS) {
    await verifyTransport()
  }
  return verified?.ok ? "ok" : "failed"
}

/** Closes the SMTP pool (shutdown, 10.4). */
export function closeTransport() {
  transport?.close()
}

export async function sendSmtp(
  smtp: NonNullable<typeof transport>,
  message: Message
) {
  const { to, subject, text, html } = message
  await smtp.sendMail({ from: env.MAIL_FROM, to, subject, text, html })
}
