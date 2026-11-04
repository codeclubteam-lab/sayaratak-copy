import type { MiddlewareHandler } from "hono"

import { fail } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"

type Limit = { max: number; seconds: number }

const MINUTE = 60
const HOUR = 3600

// Owner table, 10.1. `user` counts per account, `ip` is a loose ceiling
// because whole mobile carriers share a few addresses (A12). No `user` means
// a public route.
const LIMITS = {
  contact: { ip: { max: 10, seconds: HOUR } },
  reports: {
    user: { max: 10, seconds: HOUR },
    ip: { max: 60, seconds: HOUR },
  },
  reviews: {
    user: { max: 10, seconds: HOUR },
    ip: { max: 60, seconds: HOUR },
  },
  threads: {
    user: { max: 20, seconds: HOUR },
    ip: { max: 100, seconds: HOUR },
  },
  messages: {
    user: { max: 30, seconds: MINUTE },
    ip: { max: 300, seconds: MINUTE },
  },
  uploads: {
    user: { max: 60, seconds: HOUR },
    ip: { max: 300, seconds: HOUR },
  },
  events: { ip: { max: 120, seconds: MINUTE } },
  payments: {
    user: { max: 5, seconds: HOUR },
    ip: { max: 20, seconds: HOUR },
  },
} as const satisfies Record<string, { user?: Limit; ip: Limit }>

type Name = keyof typeof LIMITS

// Fixed window per key. ponytail: in memory, so one instance only (A12); a
// Postgres store when a second API instance runs.
const windows = new Map<string, { count: number; endsAt: number }>()
const SWEEP_AT = 10_000

/**
 * 429 `too_many_attempts` with `retryAfter` once a caller passes its limit
 * (A12). Put it after `spec()` so an idempotent replay is not counted, and
 * after `requireUser` on routes that have a `user` limit. The account is
 * checked first, so a blocked account does not use up its address.
 */
export function rateLimit(name: Name): MiddlewareHandler {
  const limits: { user?: Limit; ip: Limit } = LIMITS[name]
  return async (c, next) => {
    const now = clock.now().getTime()
    const viewer = c.get("viewer")
    if (limits.user && viewer)
      take(`${name}:user:${viewer.id}`, limits.user, now)
    take(`${name}:ip:${c.get("clientIp")}`, limits.ip, now)
    await next()
  }
}

function take(key: string, { max, seconds }: Limit, now: number) {
  let slot = windows.get(key)
  if (!slot || slot.endsAt <= now) {
    if (windows.size >= SWEEP_AT) sweep(now)
    slot = { count: 0, endsAt: now + seconds * 1000 }
    windows.set(key, slot)
  }
  if (slot.count >= max) fail.tooMany(Math.ceil((slot.endsAt - now) / 1000))
  slot.count++
}

function sweep(now: number) {
  for (const [key, slot] of windows) if (slot.endsAt <= now) windows.delete(key)
}

/** For tests: every counter starts empty. */
export function resetRateLimits() {
  windows.clear()
}
