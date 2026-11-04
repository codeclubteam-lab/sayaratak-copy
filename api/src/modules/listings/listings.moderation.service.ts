import type {
  ListingStatus,
  Moderation,
} from "@sayaratak/shared/schemas/listing"

import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { both } from "~/shared/text/bilingual"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import { notify } from "~/modules/notifications/notifications.service"
import * as savedSearches from "~/modules/saved-searches/saved-searches.service"

import * as q from "./listings.queries"
import type { ListingRow } from "./listings.view.service"

export type ModerationAction = "approve" | "reject" | "remove" | "restore"

// Handoff "Moderation" and the admin sheet: the states each action starts from.
// A draft is a seller's unpublished work and never moves.
const FROM: Record<ModerationAction, Moderation[]> = {
  approve: ["pending", "rejected"],
  reject: ["pending", "approved"],
  remove: ["pending", "approved", "rejected"],
  restore: ["removed"],
}
// A bulk reject only takes pending listings (mock); the others follow `FROM`.
const BULK_FROM: Record<ModerationAction, Moderation[]> = {
  ...FROM,
  reject: ["pending"],
}

const APPROVED_TITLE = {
  ar: "تمت الموافقة على إعلانك",
  en: "Your listing was approved",
}
const REJECTED_TITLE = { ar: "تم رفض إعلانك", en: "Your listing was rejected" }

/**
 * Approves, rejects, removes or restores one listing inside the caller's
 * transaction.
 * 404 for an unknown listing, 409 `conflict` when its state does not fit
 * the action, so a second click cannot notify the owner twice.
 */
export async function moderateOne(
  tx: Transaction,
  actor: Actor,
  change: { id: string; action: ModerationAction; reason?: string }
) {
  // FOR UPDATE: two admins pressing Approve together act one after the other.
  const row = await q.lockListing(tx, change.id)
  if (!row) fail.notFound()
  if (!FROM[change.action].includes(row.moderation)) fail.conflict()
  return move(tx, actor, { row, action: change.action, reason: change.reason })
}

/**
 * The report action's removal: removes the listing when it is pending,
 * approved or rejected, and answers the row as it is after. A listing that is
 * gone, a draft or already removed is left alone and answers `undefined`, so
 * closing a report never fails on the listing and nobody is told twice.
 */
export async function removeIfLive(tx: Transaction, actor: Actor, id: string) {
  const row = await q.lockListing(tx, id)
  if (!row || !FROM.remove.includes(row.moderation)) return undefined
  return move(tx, actor, { row, action: "remove" })
}

/**
 * The bulk bar: the action on every picked listing it fits, the others are
 * skipped. Returns how many changed. Rows are locked in id order so two
 * overlapping bulk requests cannot wait on each other.
 */
export async function moderateMany(
  tx: Transaction,
  actor: Actor,
  change: { ids: string[]; action: ModerationAction; reason?: string }
) {
  if (change.action === "reject" && !change.reason)
    fail.validation({ reason: "validation.required" })
  let count = 0
  for (const id of [...new Set(change.ids)].sort()) {
    const row = await q.lockListing(tx, id)
    if (!row || !BULK_FROM[change.action].includes(row.moderation)) continue
    await move(tx, actor, { row, action: change.action, reason: change.reason })
    count += 1
  }
  return count
}

/** `PATCH /admin/listings/:id`: the admin sets the sale state (available, reserved, sold, rented). */
export async function setStatus(
  tx: Transaction,
  actor: Actor,
  change: { id: string; status: ListingStatus }
) {
  const row = await q.lockListing(tx, change.id)
  if (!row) fail.notFound()
  const saved = await q.updateListing(tx, {
    id: row.id,
    set: { status: change.status, updatedAt: clock.now() },
  })
  await recordAudit(tx, actor, {
    action: "listing.update",
    targetType: "listing",
    targetId: row.id,
    before: { status: row.status },
    after: { status: saved.status },
  })
  return saved
}

async function move(
  tx: Transaction,
  actor: Actor,
  change: { row: ListingRow; action: ModerationAction; reason?: string }
) {
  const { row } = change
  const saved = await q.updateListing(tx, {
    id: row.id,
    set: setOf(change.action, change.reason),
  })
  await recordAudit(tx, actor, {
    action: `listing.${change.action}`,
    targetType: "listing",
    targetId: row.id,
    before: { moderation: row.moderation },
    after: { moderation: saved.moderation },
    reason: change.action === "reject" ? change.reason : undefined,
  })
  await tellPeople(tx, {
    row: saved,
    action: change.action,
    reason: change.reason,
  })
  return saved
}

// Mock: approving or restoring clears the rejection note and stamps the change; a removal
// changes only the state.
function setOf(action: ModerationAction, reason: string | undefined) {
  if (action === "remove") return { moderation: "removed" as const }
  const updatedAt = clock.now()
  if (action === "reject")
    return {
      moderation: "rejected" as const,
      rejectionReason: reason,
      updatedAt,
    }
  return { moderation: "approved" as const, rejectionReason: null, updatedAt }
}

// The owner hears about an approval or a rejection; an approval is a new match for saved searches.
async function tellPeople(
  tx: Transaction,
  event: { row: ListingRow; action: ModerationAction; reason?: string }
) {
  const { row } = event
  if (event.action === "remove") return
  if (row.ownerUserId) {
    const approved = event.action !== "reject"
    await notify(tx, {
      userId: row.ownerUserId,
      type: approved ? "listing_approved" : "listing_rejected",
      title: approved ? APPROVED_TITLE : REJECTED_TITLE,
      body: both(approved ? row.title : (event.reason ?? "")),
      href: "/listings",
    })
  }
  if (event.action !== "reject") await savedSearches.onListingApproved(tx, row)
}
