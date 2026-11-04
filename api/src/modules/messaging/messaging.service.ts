import type { Executor, Transaction } from "~/shared/db/tx"
import type { DayRange } from "~/shared/time/khartoum"

import * as q from "./messaging.queries"

/**
 * A deleted account's threads go with it, the other side's copy too, as in
 * the mock (A2 "Account deletion").
 */
export async function deleteThreadsOf(tx: Transaction, userId: string) {
  await q.deleteThreadsOf(tx, userId)
}

/** Unread messages from others in the user's threads. */
export function countUnreadMessages(ex: Executor, userId: string) {
  return q.countUnread(ex, userId)
}

/**
 * Messages from others in the user's threads per Khartoum day, as `day` to
 * count; days without one are left out. `userId` null counts all of them.
 */
export async function countReceivedPerDay(
  ex: Executor,
  userId: string | null,
  days: DayRange
) {
  const rows = await q.listReceivedPerDay(ex, userId, days)
  return new Map(rows.map((row) => [row.day, row.count]))
}
