import type { MiddlewareHandler } from "hono"

import { env } from "~/env"
import { log } from "~/shared/log/logger"

type Logger = Pick<typeof log, "debug" | "info">

const HEALTH_PREFIX = "/api/health/"

/**
 * 10.4: one line per answered request with its id, method, route, status,
 * duration, the signed-in account's id and the client's IP (`clientIp`). `route` is the registered pattern
 * (`/api/v1/listings/:id`), never the raw path or query, so ids, slugs and
 * device tokens stay out of the logs (A12). Health checks are debug lines: a
 * load balancer asks every few seconds.
 */
export function requestLog(
  logger: Logger = log,
  enabled: () => boolean = () => env.LOG_REQUESTS
): MiddlewareHandler {
  return async (c, next) => {
    const startedAt = performance.now()
    await next()
    if (!enabled()) return
    const route = c.req.routePath
    const write = route.startsWith(HEALTH_PREFIX) ? logger.debug : logger.info
    write("request", {
      requestId: c.get("requestId"),
      method: c.req.method,
      route,
      status: c.res.status,
      ms: Math.round(performance.now() - startedAt),
      userId: c.get("viewer")?.id,
      // The address the rate limits use, so the 10.5 proxy check can read it off the log.
      ip: c.get("clientIp"),
    })
  }
}
