import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { messages } from "./messaging.tables"

export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert

export function insert(ex: Executor, row: NewMessageRow) {
  return ex
    .insert(messages)
    .values(row)
    .returning()
    .then(([inserted]) => {
      // One row in, one row back; anything else is a driver fault.
      if (!inserted) throw new Error("insert into messages returned no row")
      return inserted
    })
}

/** The newest message of each thread (the preview line). */
export function listLast(ex: Executor, threadIds: string[]) {
  if (threadIds.length === 0) return Promise.resolve([])
  return ex
    .selectDistinctOn([messages.threadId])
    .from(messages)
    .where(inArray(messages.threadId, threadIds))
    .orderBy(messages.threadId, desc(messages.createdAt), desc(messages.id))
}

/** Messages the user has not read, per thread: those the other side wrote. */
export function listUnreadCounts(
  ex: Executor,
  find: { userId: string; threadIds: string[] }
) {
  if (find.threadIds.length === 0) return Promise.resolve([])
  return ex
    .select({
      threadId: messages.threadId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.threadId, find.threadIds),
        ne(messages.senderId, find.userId),
        isNull(messages.readAt)
      )
    )
    .groupBy(messages.threadId)
}

/** Where a page of a thread's messages starts. */
export type ListFind = {
  threadId: string
  /** Only messages older than this one. */
  before?: { createdAt: Date; id: string }
  page: { offset: number; size: number }
}

/**
 * One page of a thread's messages with how many match. Without `before` the
 * oldest come first (page 1 is the start of the conversation); with it the
 * page counts back from that message, and is returned oldest first.
 */
export async function listOf(ex: Executor, find: ListFind) {
  const where = and(
    eq(messages.threadId, find.threadId),
    find.before ? olderThan(find.before) : undefined
  )
  const order = find.before
    ? [desc(messages.createdAt), desc(messages.id)]
    : [asc(messages.createdAt), asc(messages.id)]
  const [rows, total] = await Promise.all([
    ex
      .select()
      .from(messages)
      .where(where)
      .orderBy(...order)
      .limit(find.page.size)
      .offset(find.page.offset),
    ex.$count(messages, where),
  ])
  return { rows: find.before ? rows.reverse() : rows, total }
}

/** A message of this thread, to start a list before it. */
export function getCursor(
  ex: Executor,
  find: { id: string; threadId: string }
) {
  return ex
    .select({ createdAt: messages.createdAt, id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, find.id), eq(messages.threadId, find.threadId)))
    .then(([row]) => row)
}

/** The other side's unread messages of the thread are read now. */
export function updateRead(
  ex: Executor,
  read: { threadId: string; userId: string; at: Date }
) {
  return ex
    .update(messages)
    .set({ readAt: read.at })
    .where(
      and(
        eq(messages.threadId, read.threadId),
        ne(messages.senderId, read.userId),
        isNull(messages.readAt)
      )
    )
}

function olderThan(cursor: { createdAt: Date; id: string }) {
  return or(
    lt(messages.createdAt, cursor.createdAt),
    and(eq(messages.createdAt, cursor.createdAt), lt(messages.id, cursor.id))
  )
}
