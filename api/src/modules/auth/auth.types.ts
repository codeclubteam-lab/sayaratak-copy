import type { Actor } from "~/modules/audit/audit.types"

import type { NewUserRow as UserInsert, UserRow } from "./auth.tables"

/** The signed-in account, as the session middleware loads it. */
export type SessionUser = UserRow

/** Columns a service may set when it saves an account. */
export type NewUserRow = UserInsert

declare module "hono" {
  interface ContextVariableMap {
    // Set on every v1 request by `session`: null when signed out.
    viewer: SessionUser | null
    // Set by `requireUser`; routes after it read the user from here.
    user: SessionUser
    // Set by `requireAdmin`: who acts and from where, for the audit row.
    actor: Actor
  }
}
