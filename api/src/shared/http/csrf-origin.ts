import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"

import { fail } from "~/shared/http/errors"

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]
// Better-Auth names the cookie from `cookiePrefix: "sy"` (A6); secure cookies
// in production get the __Secure- prefix.
const SESSION_COOKIES = ["sy.session_token", "__Secure-sy.session_token"]

/**
 * A12: a state-changing request that carries the session cookie must come from
 * the web origin, or it is 403. Bearer requests from the apps carry no cookie,
 * so there is nothing to forge (A3).
 */
export function csrfOrigin(webOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    const cookies = getCookie(c)
    const hasSession = SESSION_COOKIES.some((name) => name in cookies)
    const unsafe = !SAFE_METHODS.includes(c.req.method)
    if (unsafe && hasSession && c.req.header("origin") !== webOrigin) {
      fail.forbidden()
    }
    await next()
  }
}
