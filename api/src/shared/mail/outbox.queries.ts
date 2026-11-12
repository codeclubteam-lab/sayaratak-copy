import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm"

import { deleteBatch } from "~/shared/db/delete-batch"
import type { Executor } from "~/shared/db/tx"

import { type NewOutboxRow, outbox } from "./outbox.tables"

export type { OutboxRow } from "./outbox.tables"

const CODE_MAIL_LOCK = "sayaratak:code-mail"

/** Hold through count plus insertion so concurrent code sends cannot reserve the same slot. */
export async function lockMailRecipient(ex: Executor, to: string) {
  // Transaction-scoped and recipient-specific; collisions only serialize unrelated recipients.
  await ex.execute(
    sql`select pg_advisory_xact_lock(hashtext(${CODE_MAIL_LOCK}), hashtext(${to}))`
  )
}

export function insertOutbox(ex: Executor, row: NewOutboxRow) {
  return ex
    .insert(outbox)
    .values(row)
    .returning()
    .then(([inserted]) => inserted)
}

/** Several rows in one statement (a chunk of a broadcast). */
export async function insertOutboxMany(ex: Executor, rows: NewOutboxRow[]) {
  if (rows.length > 0) await ex.insert(outbox).values(rows)
}

/** Sent: the code is dropped from the row (A9). */
export function updateOutboxSent(ex: Executor, id: string, at: Date) {
  return ex
    .update(outbox)
    .set({ sentAt: at, payload: {}, lastError: null })
    .where(eq(outbox.id, id))
}

/** Failed: one more attempt counted, retried by the outbox job after `sendAfter`. */
export function updateOutboxFailed(
  ex: Executor,
  id: string,
  failure: { error: string; sendAfter: Date }
) {
  return ex
    .update(outbox)
    .set({
      attempts: sql`${outbox.attempts} + 1`,
      lastError: failure.error,
      sendAfter: failure.sendAfter,
    })
    .where(eq(outbox.id, id))
}

/** Mails written to one address since `since`, sent or not. */
export function countSentTo(ex: Executor, to: string, since: Date) {
  return ex.$count(outbox, and(eq(outbox.to, to), gt(outbox.createdAt, since)))
}

type DueFilter = {
  now: Date
  size: number
  /** Rows that failed this many times are left alone. */
  maxAttempts: number
  /** A new row is sent by the request that wrote it; the job only takes it once it is this old. */
  firstTryBefore: Date
}

/**
 * Unsent rows whose turn has come, oldest first. A row on its first try belongs to the request
 * that wrote it, so it is left alone until `firstTryBefore` (a crash between the insert and the send).
 */
export function listDue(ex: Executor, find: DueFilter) {
  return ex
    .select()
    .from(outbox)
    .where(
      and(
        isNull(outbox.sentAt),
        lt(outbox.attempts, find.maxAttempts),
        lte(outbox.sendAfter, find.now),
        or(gt(outbox.attempts, 0), lte(outbox.createdAt, find.firstTryBefore))
      )
    )
    .orderBy(asc(outbox.sendAfter))
    .limit(find.size)
}

/**
 * Empties the code of up to `size` unsent mails written before `before` and gives them up, so a
 * dump never holds a live code and no mail goes out with a dead one (A9, A10). Answers how many.
 */
export function updateCodesCleared(
  ex: Executor,
  change: { before: Date; size: number; maxAttempts: number }
) {
  const due = ex
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.channel, "email"),
        isNull(outbox.sentAt),
        lte(outbox.createdAt, change.before),
        sql`${outbox.payload} ->> 'code' is not null`
      )
    )
    .limit(change.size)
    .for("update", { skipLocked: true })
  return ex
    .update(outbox)
    .set({
      payload: {},
      attempts: change.maxAttempts,
      lastError: "code_expired",
    })
    .where(inArray(outbox.id, due))
    .returning({ id: outbox.id })
    .then((rows) => rows.length)
}

/** Deletes up to `size` rows sent before `before`, or given up (never sent, `maxAttempts` tries) and written before it. */
export function deleteDoneBatch(
  ex: Executor,
  batch: { before: Date; size: number; maxAttempts: number }
) {
  // Written as SQL text, not `and`/`or`, which may answer undefined; this one must never be empty.
  const sent = sql`(${outbox.sentAt} is not null and ${outbox.sentAt} < ${batch.before})`
  const givenUp = sql`(${outbox.sentAt} is null and ${outbox.attempts} >= ${batch.maxAttempts} and ${outbox.createdAt} < ${batch.before})`
  return deleteBatch(
    ex,
    { table: outbox, where: sql`${sent} or ${givenUp}` },
    batch.size
  )
}
