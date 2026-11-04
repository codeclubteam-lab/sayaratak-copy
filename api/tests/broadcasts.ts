import { eq, and, sql } from "drizzle-orm"

import {
  broadcasts,
  notifications,
} from "~/modules/notifications/notifications.tables"
import { db } from "~/shared/db/client"

type Queued = Partial<typeof broadcasts.$inferInsert>
let counter = 0

/** A broadcast waiting for the job, as `POST /admin/broadcasts` leaves it. */
export async function queueBroadcast(extra: Queued = {}) {
  counter += 1
  const row = {
    id: `bc-t${counter}`,
    title: { ar: "أهلا", en: `Hello ${counter}` },
    body: { ar: "رسالة", en: "A message" },
    roles: ["user" as const],
    verifiedOnly: false,
    status: "queued" as const,
    recipients: 0,
    createdAt: new Date(),
    ...extra,
  }
  await db.insert(broadcasts).values(row)
  return row
}

/** The bells a broadcast rang, found by its English title. */
export const bellsOf = (title: { en: string }) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.type, "broadcast"),
        sql`${notifications.title} ->> 'en' = ${title.en}`
      )
    )

export const broadcastRow = (id: string) =>
  db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.id, id))
    .then(([row]) => row)
