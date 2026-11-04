import type { HookEndpointContext } from "better-auth"
import { APIError, isAPIError } from "better-auth/api"

import { db } from "~/shared/db/client"

import {
  CLIENT_IP_HEADER,
  clearSignInFailures,
  recordSignInFailure,
  refuseWhileThrottled,
} from "./auth.guard.service"
import * as q from "./auth.queries"

// The admin second step (A6, 3.7). Admins are the only accounts with
// two-factor on: after the password, Better-Auth answers `twoFactorRedirect`
// and sets its `two_factor` cookie; the code comes from /two-factor/send-otp
// and is checked by /two-factor/verify-otp, the route these hooks guard.
export const ADMIN_CODE_PATH = "/two-factor/verify-otp"
const CHALLENGE_COOKIE = "two_factor"
const WRONG_CODE = "INVALID_CODE"

/**
 * Before the code check: the sign-in throttle (wrong codes count as wrong
 * passwords, so five lock this email and IP for 10 minutes), and no
 * trusted-device cookie for admins (A6): it would skip the code next time.
 */
export async function adminCodeBefore(ctx: HookEndpointContext) {
  if (ctx.body?.trustDevice === true)
    throw new APIError("FORBIDDEN", { code: "forbidden" })
  const email = await challengeEmail(ctx)
  if (email) await refuseWhileThrottled({ email, ip: ipOf(ctx) })
}

/** After the code check: marks the new session, or counts a wrong code. */
export async function adminCodeAfter(ctx: HookEndpointContext) {
  const returned = ctx.context.returned
  const created = ctx.context.newSession
  if (!isAPIError(returned) && created) {
    await q.updateSecondStep(db, created.session.id)
    await clearSignInFailures(created.user.email)
    return
  }
  if (!isAPIError(returned) || returned.body?.code !== WRONG_CODE) return
  const email = await challengeEmail(ctx)
  if (email) await recordSignInFailure({ email, ip: ipOf(ctx) })
}

/**
 * Whether `/api/v1/admin/*` refuses this request: apps never reach admin
 * routes (A18), and an admin session must have passed the code. Other roles
 * and signed-out requests pass on to `requireRole`, which answers them.
 */
export async function refusesAdminRoute(input: {
  headers: Headers
  role: string | undefined
  sessionId: string | undefined
}) {
  if (input.headers.get("authorization")?.startsWith("Bearer ")) return true
  if (input.role !== "admin" || !input.sessionId) return false
  return !(await q.hasSecondStep(db, input.sessionId))
}

// The account behind Better-Auth's signed challenge cookie, or null.
async function challengeEmail(ctx: HookEndpointContext) {
  const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE)
  const id = await ctx.getSignedCookie?.(cookie.name, ctx.context.secret)
  if (!id) return null
  const row = await ctx.context.internalAdapter.findVerificationValue(id)
  return row ? ((await q.getUserEmail(db, row.value)) ?? null) : null
}

function ipOf(ctx: HookEndpointContext) {
  return ctx.headers?.get(CLIENT_IP_HEADER) ?? ""
}
