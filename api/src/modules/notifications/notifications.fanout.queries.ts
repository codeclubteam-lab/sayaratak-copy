import { asc, eq, inArray, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import type { NewNotificationRow } from "./notifications.queries"
import { broadcasts, notifications } from "./notifications.tables"

export type BroadcastRow = typeof broadcasts.$inferSelect

/**
 * The oldest broadcast that is not finished, locked until the transaction ends. `skipLocked`
 * leaves it alone when another run holds it.
 */
export function lockUnfinished(ex: Executor) {
  return ex
    .select()
    .from(broadcasts)
    .where(inArray(broadcasts.status, ["queued", "sending"]))
    .orderBy(
      asc(broadcasts.createdAt),
      asc(sql`length(${broadcasts.id})`),
      asc(broadcasts.id)
    )
    .limit(1)
    .for("update", { skipLocked: true })
    .then(([row]) => row)
}

/** Moves a broadcast on by one chunk: the new cursor, the people reached, and whether it is done. */
export function updateProgress(
  ex: Executor,
  change: {
    id: string
    cursor: string | null
    reached: number
    finishedAt: Date | null
  }
) {
  return ex
    .update(broadcasts)
    .set({
      cursor: change.cursor,
      recipients: sql`${broadcasts.recipients} + ${change.reached}`,
      status: change.finishedAt ? "sent" : "sending",
      finishedAt: change.finishedAt,
    })
    .where(eq(broadcasts.id, change.id))
}

/** A chunk of bells in one statement. */
export async function insertMany(ex: Executor, rows: NewNotificationRow[]) {
  if (rows.length > 0) await ex.insert(notifications).values(rows)
}
