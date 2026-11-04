import type { Role } from "@sayaratak/shared/schemas/fields"
import type { MiddlewareHandler } from "hono"

import { fail } from "~/shared/http/errors"

import { refusesAdminRoute } from "./auth.admin.service"
import { isBannedNow, loadViewer } from "./auth.service"
import "./auth.types"

const AUTH_PATH = "/api/v1/auth/"
const ADMIN_PATH = "/api/v1/admin/"

/**
 * Puts the signed-in account (cookie or bearer, A18) on `viewer`, or null.
 * Runs on every v1 request after csrfOrigin (A3). Passes on Better-Auth's
 * refreshed session cookie when it extended the session. `/admin/*` is 403
 * `forbidden` for a bearer token and for an admin who skipped the code (3.7).
 */
export const session: MiddlewareHandler = async (c, next) => {
  // Better-Auth reads its own session on its routes.
  if (c.req.path.startsWith(AUTH_PATH)) return next()
  const { viewer, headers, sessionId } = await loadViewer(c.req.raw.headers)
  if (
    c.req.path.startsWith(ADMIN_PATH) &&
    (await refusesAdminRoute({
      headers: c.req.raw.headers,
      role: viewer?.role,
      sessionId,
    }))
  )
    fail.forbidden()
  c.set("viewer", viewer)
  await next()
  for (const cookie of headers.getSetCookie()) {
    c.res.headers.append("set-cookie", cookie)
  }
}

/** Signed out is 401 `unauthenticated`, banned is 403 `banned`; sets `user`. */
export const requireUser: MiddlewareHandler = async (c, next) => {
  const viewer = c.get("viewer")
  if (!viewer) fail.unauthenticated()
  if (isBannedNow(viewer)) fail.banned()
  c.set("user", viewer)
  await next()
}

/** `requireUser`, then 403 `forbidden` unless the account has one of `roles`. */
export function requireRole(...roles: Role[]): MiddlewareHandler {
  return async (c, next) => {
    await requireUser(c, async () => {
      if (!roles.includes(c.get("user").role)) fail.forbidden()
      await next()
    })
  }
}

/** `requireRole("admin")`, then sets `actor` (the admin and their address) for the audit row. */
export const requireAdmin: MiddlewareHandler = (c, next) =>
  requireRole("admin")(c, async () => {
    c.set("actor", { admin: c.get("user"), ip: c.get("clientIp") })
    await next()
  })
