import type { MiddlewareHandler } from "hono"

import { fail } from "~/shared/http/errors"

type Platform = "ios" | "android" | "web"
type Minimums = { ios?: string; android?: string }

declare module "hono" {
  interface ContextVariableMap {
    platform: Platform
  }
}

const SEMVER = /^\d+\.\d+\.\d+$/

/**
 * A18: the apps send `X-Platform` and `X-App-Version`; below the minimum for
 * that platform the answer is 426 `upgrade_required`, so an old build asks
 * the user to update instead of breaking. No header (or any other value)
 * means web, which is never gated. Sets `platform` for logs and analytics.
 */
export function appVersion(minimums: Minimums): MiddlewareHandler {
  return async (c, next) => {
    const platform = toPlatform(c.req.header("x-platform"))
    c.set("platform", platform)
    const minimum = platform === "web" ? undefined : minimums[platform]
    if (minimum && isBelow(c.req.header("x-app-version"), minimum)) {
      fail.upgradeRequired()
    }
    await next()
  }
}

function toPlatform(header: string | undefined): Platform {
  if (header === "ios" || header === "android") return header
  return "web"
}

// Every app build sends its version, so a missing or malformed one reads as
// older than any minimum.
function isBelow(version: string | undefined, minimum: string) {
  if (!version || !SEMVER.test(version)) return true
  return Bun.semver.order(version, minimum) < 0
}
