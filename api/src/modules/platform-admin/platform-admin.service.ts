import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import { env } from "~/env"
import { db } from "~/shared/db/client"
import { type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { send } from "~/shared/mail/send"
import { clock } from "~/shared/time/clock"
import {
  clearSignInFailures,
  recordSignInFailure,
  signInWait,
} from "~/modules/auth/auth.guard.service"
import * as admin from "~/modules/auth/auth.platform.service"

// The platform admin endpoint (8.12). Two locks on every call: the secret key in the header, and a
// 6-digit code mailed to the owner's inbox. The code is not stored: it is an HMAC (keyed with the
// Better-Auth secret, which the key holder does not have) of the exact change and the second it was
// asked at, so it fits that change only, for 10 minutes. A repeat of the same change finds the state
// already changed (409/404), except an update, which repeats harmlessly.
const CODE_SECONDS = 600
// Wrong keys and wrong codes count in the sign-in throttle (5 per IP in 10 minutes) under this name.
const THROTTLE = "platform-admin"

// The bodies of the changes, for the routes to validate with.
export {
  adminInputSchema,
  adminPatchSchema,
} from "~/modules/auth/auth.platform.service"

type Confirm = { code: string | undefined; at: string | undefined }

/** 404 while the endpoint is off, 429 while this IP is throttled, 403 for a wrong or missing key. */
export async function checkSecretKey(call: { key?: string; ip: string }) {
  if (!env.ADMIN_SECRET_KEY || !env.ADMIN_RECOVERY_EMAIL) fail.notFound()
  const wait = await signInWait({ email: THROTTLE, ip: call.ip })
  if (wait !== null) fail.tooMany(wait)
  if (call.key && same(call.key, env.ADMIN_SECRET_KEY)) return
  await recordSignInFailure({ email: THROTTLE, ip: call.ip })
  fail.forbidden()
}

/** Step 1: checks the change can run, mails its code to the owner's inbox, answers when it was asked. */
export async function requestCode(change: admin.AdminChange) {
  await admin.assertAdminChange(db, change)
  const at = seconds()
  send.platformAdminCode(codeFor(change, at))
  return { at, expiresIn: CODE_SECONDS }
}

/** Step 2: runs the change when `confirm` is the code asked for exactly this change, less than 10 minutes ago. */
export async function confirmChange(
  call: { ip: string; confirm: Confirm },
  change: admin.AdminChange
) {
  await checkCode(call, change)
  const via = { reason: "platform endpoint", ip: call.ip }
  const done = await transaction((tx) => run(tx, change, via))
  await clearSignInFailures(THROTTLE)
  return done
}

async function run(tx: Transaction, change: admin.AdminChange, via: admin.Via) {
  if (change.op === "create")
    return admin.createPlatformAdmin(tx, change.input, via)
  if (change.op === "update")
    return admin.updatePlatformAdmin(tx, change.input, via)
  await admin.deletePlatformAdmin(tx, via)
  return undefined
}

// 422 `otp_invalid` for a missing or wrong code, 410 `code_expired` after 10 minutes.
async function checkCode(
  call: { ip: string; confirm: Confirm },
  change: admin.AdminChange
) {
  const at = Number(call.confirm.at)
  const age = seconds() - at
  const ok =
    !!call.confirm.code &&
    Number.isInteger(at) &&
    age >= 0 &&
    same(call.confirm.code, codeFor(change, at))
  if (ok && age <= CODE_SECONDS) return
  await recordSignInFailure({ email: THROTTLE, ip: call.ip })
  if (ok) fail.gone()
  fail.invalid("otp_invalid")
}

function codeFor(change: admin.AdminChange, at: number) {
  const digest = createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${at}|${JSON.stringify(change)}`)
    .digest()
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0")
}

const seconds = () => Math.floor(clock.now().getTime() / 1000)

// Equal-time comparison of two strings of any length.
function same(a: string, b: string) {
  const hash = (text: string) => createHash("sha256").update(text).digest()
  return timingSafeEqual(hash(a), hash(b))
}
