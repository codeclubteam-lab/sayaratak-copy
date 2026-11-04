import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { payments } from "~/modules/payments/payments.tables"
import { subscriptions } from "~/modules/plans/plans.tables"
import { promotions } from "~/modules/promotions/promotions.tables"

export const rowOf = (id: string) =>
  db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .then(([row]) => row)
export const noticesTo = (
  userId: string,
  type: "payment_approved" | "payment_rejected"
) =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, type)))
export const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
export const activeOf = (userId: string) =>
  db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
export const promotionOf = (id: string) =>
  db
    .select()
    .from(promotions)
    .where(eq(promotions.id, id))
    .then(([row]) => row)
// A receipt for a banner campaign: the seed has none, so the row is written directly.
export async function campaignReceipt() {
  const [source] = await db.select().from(payments).limit(1)
  const row = {
    ...source,
    id: "pay-camp",
    userId: "u-workshop",
    itemType: "campaign" as const,
    itemId: "camp-2",
    status: "pending_review" as const,
    reference: "SY-123456",
  }
  await db.insert(payments).values(row as typeof payments.$inferInsert)
  return row.id
}
