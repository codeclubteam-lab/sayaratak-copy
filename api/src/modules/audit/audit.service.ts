import type { Executor } from "~/shared/db/tx"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"

import * as q from "./audit.queries"
import type { Actor, AuditEntry } from "./audit.types"

/**
 * Writes the audit row of one admin action (A1 rule 6). Call it with the
 * transaction that makes the change, so the row exists only if the change does.
 * Example: `recordAudit(tx, actor, { action: "listing.reject", targetType: "listing", targetId, reason })`.
 */
export async function recordAudit(
  ex: Executor,
  actor: Actor,
  entry: AuditEntry
) {
  await q.insert(ex, {
    id: newId("au"),
    adminId: actor.admin.id,
    ip: actor.ip,
    ...entry,
    createdAt: clock.now(),
  })
}

/**
 * The audit row of a change nobody was signed in for: the `create-admin` command and the platform
 * admin endpoint (8.12). The admin column stays empty; `reason` says where it came from.
 */
export async function recordSystemAudit(
  ex: Executor,
  entry: AuditEntry & { ip?: string }
) {
  await q.insert(ex, {
    id: newId("au"),
    adminId: null,
    ...entry,
    createdAt: clock.now(),
  })
}
