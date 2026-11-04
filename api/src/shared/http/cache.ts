import type { MiddlewareHandler } from "hono"

const PUBLIC_MAX_AGE_SECONDS = 60

/**
 * A12: the public reference reads (taxonomy, site, plans, pages) may be cached
 * for a minute; errors are not. The app-wide header middleware turns it back to `no-store`
 * when the answer also sets a cookie.
 */
export const publicCache: MiddlewareHandler = async (c, next) => {
  await next()
  if (c.res.status !== 200) return
  c.header("Cache-Control", `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`)
}
