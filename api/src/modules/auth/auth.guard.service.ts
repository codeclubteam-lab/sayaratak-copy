import { passwordSchema } from "@sayaratak/shared/schemas/fields"
import { APIError, isAPIError } from "better-auth/api"

import { db } from "~/shared/db/client"
import { log } from "~/shared/log/logger"
import { clock } from "~/shared/time/clock"

import * as q from "./auth.queries"

// Owner, 3.6. Per email and IP, so an attacker cannot lock the owner out
// from elsewhere; per email from every IP, so spreading guesses over many
// IPs does not help either.
const PAIR_MAX_FAILURES = 5
const PAIR_WINDOW_MS = 10 * 60_000
const EMAIL_MAX_FAILURES = 20
const EMAIL_WINDOW_MS = 60 * 60_000
const MS_PER_SECOND = 1000

// Set by `authRoutes` from our own `clientIp` (A3), never by the client.
export const CLIENT_IP_HEADER = "x-sy-client-ip"

// Where each Better-Auth route carries a new password (A6 password rules).
// Our POST /me/password parses its own body with the same schema.
const PASSWORD_FIELDS: Record<string, string> = {
  "/sign-up/email": "password",
  "/email-otp/reset-password": "password",
  "/change-password": "newPassword",
}

type Attempt = { email: string; ip: string }
type HookInput = {
  path: string
  body?: Record<string, unknown>
  headers?: Headers
}

/**
 * Better-Auth `hooks.before` (A6): password rules, sign-up for a taken email,
 * the sign-in throttle. Throws Better-Auth's own error class, which its
 * routes answer with.
 */
export async function authBefore(input: HookInput) {
  const field = PASSWORD_FIELDS[input.path]
  const problem = field ? passwordProblem(input.body?.[field]) : null
  if (field && problem)
    throw new APIError("UNPROCESSABLE_ENTITY", {
      code: "validation",
      fields: { [field]: problem },
    })
  const email = emailOf(input)
  if (
    input.path === "/sign-up/email" &&
    (await existingSignUp(email)) === "exists"
  )
    throw new APIError("CONFLICT", { code: "exists" })
  if (input.path === "/sign-in/email")
    await refuseWhileThrottled(attemptOf(input))
}

/** Better-Auth `hooks.after`: counts failed sign-ins, clears them on success or reset. */
export async function authAfter(input: HookInput & { returned: unknown }) {
  const failed = isAPIError(input.returned)
  if (input.path === "/email-otp/reset-password" && !failed)
    await clearSignInFailures(emailOf(input))
  if (input.path !== "/sign-in/email") return
  if (!failed) return clearSignInFailures(emailOf(input))
  if (
    isAPIError(input.returned) &&
    input.returned.body?.code === "INVALID_EMAIL_OR_PASSWORD"
  )
    await recordSignInFailure(attemptOf(input))
}

/**
 * Seconds until this email may try a password again from this IP, or null
 * when it may now. Five failures from one IP in 10 minutes, or twenty from
 * all IPs in an hour, close it until the oldest of them leaves its window.
 */
export async function signInWait(attempt: Attempt) {
  const now = clock.now().getTime()
  const failures = await q.listLoginFailures(
    db,
    attempt.email,
    new Date(now - EMAIL_WINDOW_MS)
  )
  const times = failures.map((row) => row.failedAt.getTime())
  const pair = failures
    .filter(
      (row) =>
        row.ip === attempt.ip && row.failedAt.getTime() > now - PAIR_WINDOW_MS
    )
    .map((row) => row.failedAt.getTime())
  const waits = [
    waitFor({
      times: pair,
      max: PAIR_MAX_FAILURES,
      windowMs: PAIR_WINDOW_MS,
      now,
    }),
    waitFor({ times, max: EMAIL_MAX_FAILURES, windowMs: EMAIL_WINDOW_MS, now }),
  ]
  const longest = Math.max(...waits)
  return longest > 0 ? longest : null
}

/** Counts one failed password sign-in. */
export async function recordSignInFailure(attempt: Attempt) {
  await q.insertLoginFailure(db, { ...attempt, failedAt: clock.now() })
}

/** A successful sign-in or password reset starts the count again. */
export async function clearSignInFailures(email: string) {
  await q.deleteLoginFailures(db, email)
}

/**
 * What sign-up does with an email that has an account (A6): a verified one,
 * or one with a Google or Facebook login, is `exists`; an unverified
 * password-only one never finished sign-up, so it is deleted and sign-up runs
 * again with the new name and password and sends a fresh code.
 */
export async function existingSignUp(email: string) {
  const row = await q.getUserByEmail(db, email)
  if (!row) return "new"
  const providers = await q.listProviders(db, row.id)
  const isUnfinished =
    !row.emailVerified && providers.every((id) => id === "credential")
  if (!isUnfinished) return "exists"
  await q.deleteUser(db, row.id)
  return "new"
}

/** The web form's password rules (8+, a letter, a digit) as i18n keys, or null when it passes. */
export function passwordProblem(password: unknown) {
  const parsed = passwordSchema.safeParse(password)
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? null)
}

/** 429 `too_many_attempts` while `signInWait` says this email and IP must wait. */
export async function refuseWhileThrottled(attempt: Attempt) {
  const retryAfter = await signInWait(attempt)
  if (retryAfter === null) return
  log.warn("rate_limited", { route: "sign-in", ...attempt, retryAfter })
  throw new APIError(
    "TOO_MANY_REQUESTS",
    { code: "too_many_attempts", retryAfter },
    { "Retry-After": String(retryAfter) }
  )
}

function emailOf(input: HookInput) {
  const email = input.body?.email
  return typeof email === "string" ? email.trim().toLowerCase() : ""
}

function attemptOf(input: HookInput) {
  return {
    email: emailOf(input),
    ip: input.headers?.get(CLIENT_IP_HEADER) ?? "",
  }
}

// The window opens again when the oldest failure that still counts leaves it.
// max 5, failures at 0, 1, 2, 3, 4 min, now 6 min: wait until 0 + 10 = 10 min, 240 s.
function waitFor(count: {
  times: number[]
  max: number
  windowMs: number
  now: number
}) {
  if (count.times.length < count.max) return 0
  const sorted = [...count.times].sort((a, b) => b - a)
  const oldestCounted = sorted[count.max - 1] ?? count.now
  return Math.ceil((oldestCounted + count.windowMs - count.now) / MS_PER_SECOND)
}
