import { and, count, eq, inArray, isNull, ne } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import { type DayRange, dayColumn, withinDays } from "~/shared/time/khartoum"

import { messages, threadParticipants, threads } from "./messaging.tables"

export function deleteThreadsOf(ex: Executor, userId: string) {
  return ex.delete(threads).where(inArray(threads.id, threadIdsOf(ex, userId)))
}

/** Messages from the other side, not read yet, in the user's threads. */
export function countUnread(ex: Executor, userId: string) {
  return ex.$count(
    messages,
    and(
      inArray(messages.threadId, threadIdsOf(ex, userId)),
      ne(messages.senderId, userId),
      isNull(messages.readAt)
    )
  )
}

/**
 * Messages per Khartoum day that other people sent in the user's threads;
 * `userId` null counts every message of every thread (the admin's view).
 */
export function listReceivedPerDay(
  ex: Executor,
  userId: string | null,
  days: DayRange
) {
  const day = dayColumn(messages.createdAt)
  return ex
    .select({ day, count: count() })
    .from(messages)
    .where(
      and(
        withinDays(messages.createdAt, days),
        userId
          ? and(
              inArray(messages.threadId, threadIdsOf(ex, userId)),
              ne(messages.senderId, userId)
            )
          : undefined
      )
    )
    .groupBy(day)
}

function threadIdsOf(ex: Executor, userId: string) {
  return ex
    .select({ id: threadParticipants.threadId })
    .from(threadParticipants)
    .where(eq(threadParticipants.userId, userId))
}
