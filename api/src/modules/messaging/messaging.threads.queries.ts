import { and, asc, eq, inArray } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { threadParticipants, threads } from "./messaging.tables"

export type ThreadRow = typeof threads.$inferSelect
export type NewThreadRow = typeof threads.$inferInsert

/** The threads the user takes part in. */
export function listOf(ex: Executor, userId: string) {
  return ex
    .select({ thread: threads })
    .from(threads)
    .innerJoin(threadParticipants, eq(threadParticipants.threadId, threads.id))
    .where(eq(threadParticipants.userId, userId))
    .then((rows) => rows.map((row) => row.thread))
}

/** Who is in each thread, first writer first (`position`, the mock's order). */
export function listParticipants(ex: Executor, threadIds: string[]) {
  if (threadIds.length === 0) return Promise.resolve([])
  return ex
    .select()
    .from(threadParticipants)
    .where(inArray(threadParticipants.threadId, threadIds))
    .orderBy(asc(threadParticipants.threadId), asc(threadParticipants.position))
}

export function getThread(ex: Executor, id: string) {
  return ex
    .select()
    .from(threads)
    .where(eq(threads.id, id))
    .then(([row]) => row)
}

export function getByPair(
  ex: Executor,
  find: Pick<ThreadRow, "subjectType" | "subjectId" | "pairKey">
) {
  return ex
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.subjectType, find.subjectType),
        eq(threads.subjectId, find.subjectId),
        eq(threads.pairKey, find.pairKey)
      )
    )
    .then(([row]) => row)
}

/** Adds the thread unless the pair already has one for the subject; then `undefined`. */
export function insertIfNew(ex: Executor, row: NewThreadRow) {
  return ex
    .insert(threads)
    .values(row)
    .onConflictDoNothing()
    .returning()
    .then(([inserted]) => inserted)
}

export function insertParticipants(
  ex: Executor,
  threadId: string,
  userIds: string[]
) {
  return ex
    .insert(threadParticipants)
    .values(userIds.map((userId, position) => ({ threadId, userId, position })))
}
