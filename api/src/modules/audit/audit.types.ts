import type { SessionUser } from "~/modules/auth/auth.types"

/** Who did an admin action and from where; routes build it from `user` and `clientIp`. */
export type Actor = { admin: SessionUser; ip: string }

/** What one admin action changed. `action` is `<targetType>.<verb>`, such as `listing.approve`. */
export type AuditEntry = {
  action: string
  targetType: string
  targetId: string
  before?: unknown
  after?: unknown
  reason?: string
}
