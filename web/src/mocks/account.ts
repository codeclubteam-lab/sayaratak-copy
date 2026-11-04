import { db, remove } from "./db"
import { businessOf, nowIso } from "./lib"
import type { UserRow } from "./types"

const drop = <T>(table: T[], gone: (row: T) => boolean) =>
  table.splice(0, table.length, ...table.filter((row) => !gone(row)))

// What deleting an account takes with it: the person, their business profile and its reviews, and everything that belonged to them. Listings stay as rows, marked removed, so the admin history keeps them.
export function removeAccount(user: UserRow) {
  const listingIds = new Set<string>()
  for (const l of db.listings)
    if (l.ownerUserId === user.id) {
      l.moderation = "removed"
      listingIds.add(l.id)
    }
  for (const p of db.promotions)
    if (listingIds.has(p.listingId) && p.status !== "ended") p.status = "ended"
  for (const p of db.payments)
    if (p.userId === user.id && p.status === "pending_review") {
      p.status = "rejected"
      p.rejectionReason = "account_deleted"
      p.reviewedAt = nowIso()
    }
  const biz = businessOf(user)?.row
  if (biz) {
    drop(db.reviews, (r) => r.targetId === biz.id)
    drop(db.events, (e) => e.targetId === biz.id)
    remove(db.dealerships, biz.id)
    remove(db.workshops, biz.id)
    remove(db.mechanics, biz.id)
  }
  const threads = new Set(
    db.threads
      .filter((t) => t.participantIds.includes(user.id))
      .map((t) => t.id)
  )
  drop(db.threads, (t) => threads.has(t.id))
  drop(db.messages, (m) => threads.has(m.threadId))
  drop(db.favorites, (f) => f.userId === user.id)
  drop(db.savedSearches, (s) => s.userId === user.id)
  drop(db.drafts, (d) => d.userId === user.id)
  drop(db.notifications, (n) => n.userId === user.id)
  drop(db.subscriptions, (s) => s.userId === user.id)
  drop(db.verifications, (v) => v.ownerId === user.id)
  remove(db.users, user.id)
}
