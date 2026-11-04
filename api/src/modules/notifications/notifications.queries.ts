import { and, desc, eq, inArray, isNull, lt, or, type SQL } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { notifications } from "./notifications.tables"

export type NewNotificationRow = typeof notifications.$inferInsert

export function countUnread(ex: Executor, userId: string) {
  return ex.$count(
    notifications,
    and(eq(notifications.userId, userId), isNull(notifications.readAt))
  )
}

export function insert(ex: Executor, row: NewNotificationRow) {
  return ex.insert(notifications).values(row)
}

/** Where a list of the user's notifications starts and what it keeps. */
export type ListFind = {
  userId: string
  unreadOnly: boolean
  /** Only notifications older than this one. */
  before?: { createdAt: Date; id: string }
  page: { offset: number; size: number }
}

/** One page of the user's notifications, newest first, with how many match. */
export async function listOf(ex: Executor, find: ListFind) {
  const where = and(
    eq(notifications.userId, find.userId),
    find.unreadOnly ? isNull(notifications.readAt) : undefined,
    find.before ? olderThan(find.before) : undefined
  )
  const [rows, total] = await Promise.all([
    ex
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(find.page.size)
      .offset(find.page.offset),
    ex.$count(notifications, where),
  ])
  return { rows, total }
}

/** The user's own notification with this id, to start a list after it. */
export function getCursor(ex: Executor, find: { id: string; userId: string }) {
  return ex
    .select({ createdAt: notifications.createdAt, id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.id, find.id), eq(notifications.userId, find.userId))
    )
    .then(([row]) => row)
}

/** Marks the user's unread notifications read: the ones named, or all when `ids` is undefined. */
export function updateRead(
  ex: Executor,
  read: { userId: string; ids?: string[]; at: Date }
) {
  return ex
    .update(notifications)
    .set({ readAt: read.at })
    .where(
      and(
        eq(notifications.userId, read.userId),
        isNull(notifications.readAt),
        read.ids ? inArray(notifications.id, read.ids) : undefined
      )
    )
}

// Newest first by time, then id, so two notifications of one instant keep a fixed order.
function olderThan(cursor: { createdAt: Date; id: string }): SQL | undefined {
  return or(
    lt(notifications.createdAt, cursor.createdAt),
    and(
      eq(notifications.createdAt, cursor.createdAt),
      lt(notifications.id, cursor.id)
    )
  )
}
