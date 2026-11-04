import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { listings } from "~/modules/listings/listings.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { reports } from "~/modules/reports/reports.tables"

// Seed: rp-1 and rp-2 are open on l00001 (approved, owner ud-2), rp-3 is open on l0000f (approved,
// owner u-omar), rp-4 on l0000m (owner ud-8), rp-5 is dismissed and rp-6 actioned (l00010, owner u-49).
export const note = "Checked: the photos are not the car"

export const reportOf = (id: string) =>
  db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .then(([row]) => row)
export const listingOf = (id: string) =>
  db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .then(([row]) => row)
export const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
export const removedNotices = (userId: string) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "listing_rejected")
      )
    )
