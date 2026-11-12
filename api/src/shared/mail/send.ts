import { z } from "zod"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { log } from "~/shared/log/logger"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"

import { retryAt } from "./backoff"
import * as q from "./outbox.queries"
import type { OutboxRow } from "./outbox.tables"
import { renderCode } from "./templates"
import { sendSmtp, transport } from "./transport"

const templateSchema = z.enum([
  "sign-in",
  "email-verification",
  "forget-password",
  "change-email",
  "admin-code",
  "platform-admin",
])
const localeSchema = z.enum(["ar", "en"]).catch("ar")

export type MailTemplate = z.infer<typeof templateSchema>
/** What a code is for, in Better-Auth's emailOTP words. */
export type OtpPurpose = Exclude<MailTemplate, "admin-code" | "platform-admin">
export type Locale = z.infer<typeof localeSchema>

type CodeMail = {
  to: string
  template: MailTemplate
  locale: Locale
  code: string
}
export type SentMail = CodeMail & {
  subject: string
  text: string
  html: string
}

// Owner, 3.6: at most 5 codes an hour to one address, so nobody can flood an
// inbox. Over the cap the mail is dropped quietly, off the request: every
// route answers the same, so the cap tells nothing about which emails exist.
const CODES_PER_HOUR = 5
const HOUR_MS = 3_600_000

/**
 * Mail sent while NODE_ENV is test, newest last. Tests read codes from here
 * instead of a mailbox (A13), after `flushMail()`.
 */
export const testInbox: SentMail[] = []
const running = new Set<Promise<void>>()

/**
 * The only way the API sends mail (A9). Each call writes an outbox row and
 * starts the delivery without waiting for it, so no answer waits on SMTP
 * (and its timing tells nothing). SMS later is a second implementation
 * behind the same calls.
 */
export const send = {
  // `locale` may still be loading (a user row lookup): it is awaited off the
  // request, with the rest of the delivery.
  otp(mail: {
    to: string
    code: string
    purpose: OtpPurpose
    locale: Locale | Promise<Locale>
  }) {
    queue({ ...mail, template: mail.purpose })
  },
  /** The confirm code of a platform admin change, to the owner's inbox (`ADMIN_RECOVERY_EMAIL`, English). */
  platformAdminCode(code: string) {
    if (!env.ADMIN_RECOVERY_EMAIL) return
    queue({
      to: env.ADMIN_RECOVERY_EMAIL,
      template: "platform-admin",
      locale: "en",
      code,
    })
  },
  adminCode(user: { email: string; locale?: unknown }, code: string) {
    const locale = localeSchema.parse(user.locale)
    queue({ to: user.email, template: "admin-code", locale, code })
  },
}

/** Waits for every delivery started so far. Tests call it before reading `testInbox`. */
export async function flushMail() {
  await Promise.all(running)
}

/** Sends one outbox row; the outbox job (A10) calls it again for failed rows. */
export async function deliver(row: OutboxRow) {
  try {
    // Parsed inside the try: a row with an unknown template fails like any send and is given up
    // after its attempts, instead of stopping the outbox job on every pass.
    const mail: CodeMail = {
      to: row.to,
      template: templateSchema.parse(row.template),
      locale: localeSchema.parse(row.locale),
      code: row.payload.code ?? "",
    }
    await transmit({ ...mail, ...renderCode(mail) })
    await q.updateOutboxSent(db, row.id, clock.now())
  } catch (error) {
    const sendAfter = retryAt(row.attempts, clock.now())
    log.error("mail_failed", { id: row.id, attempt: row.attempts + 1, error })
    await q.updateOutboxFailed(db, row.id, { error: String(error), sendAfter })
  }
}

type QueuedMail = Omit<CodeMail, "locale"> & {
  locale: Locale | Promise<Locale>
}

function queue(mail: QueuedMail) {
  // A reserved `.invalid` address (Facebook accounts with no email) never
  // gets mail; nothing is written either.
  if (mail.to.endsWith(".invalid")) return
  const work = writeAndDeliver(mail)
  running.add(work)
  // A documented fire-and-forget (A17.5): the caller's answer never
  // waits on the database insert or on SMTP.
  void work.finally(() => running.delete(work))
}

async function writeAndDeliver(mail: QueuedMail) {
  try {
    const row = await reserveCode({ ...mail, locale: await mail.locale })
    // Reservation committed and its recipient lock released before any SMTP work.
    if (row) await deliver(row)
  } catch (error) {
    log.error("mail_queue_failed", { template: mail.template, error })
  }
}

function reserveCode(mail: CodeMail) {
  return transaction(async (tx) => {
    await q.lockMailRecipient(tx, mail.to)
    const now = clock.now()
    const recent = await q.countSentTo(
      tx,
      mail.to,
      new Date(now.getTime() - HOUR_MS)
    )
    if (recent >= CODES_PER_HOUR) {
      log.warn("mail_capped", { to: mail.to, template: mail.template })
      return
    }
    return q.insertOutbox(tx, {
      id: newId("out"),
      channel: "email",
      to: mail.to,
      template: mail.template,
      locale: mail.locale,
      payload: { code: mail.code },
      sendAfter: now,
      createdAt: now,
    })
  })
}

async function transmit(mail: SentMail) {
  if (transport) return sendSmtp(transport, mail)
  if (env.NODE_ENV === "test") {
    testInbox.push(mail)
    return
  }
  // Dev without SMTP (A9): the code goes to the log so the developer can type it.
  log.info("mail_dev", {
    to: mail.to,
    template: mail.template,
    code: mail.code,
  })
}
