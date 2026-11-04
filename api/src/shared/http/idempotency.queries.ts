import { and, eq, isNull, lt, or, sql } from "drizzle-orm"

import { deleteBatch } from "~/shared/db/delete-batch"
import type { Executor } from "~/shared/db/tx"

import {
  idempotencyKeys,
  type NewIdempotencyKeyRow,
} from "./idempotency.tables"

type Id = { owner: string; key: string; createdAt: Date }
type Cutoffs = { expiredBefore: Date; staleBefore: Date }

/**
 * Inserts the key as running, or takes over a row that is past its 24 hours,
 * or one still running past the stale cutoff with the same request (its
 * server died). Returns whether this request owns the key now.
 */
export function claimKey(
  ex: Executor,
  row: NewIdempotencyKeyRow,
  { expiredBefore, staleBefore }: Cutoffs
) {
  const t = idempotencyKeys
  return ex
    .insert(t)
    .values(row)
    .onConflictDoUpdate({
      target: [t.owner, t.key],
      set: {
        method: row.method,
        path: row.path,
        requestHash: row.requestHash,
        status: null,
        responseBody: null,
        createdAt: row.createdAt,
      },
      setWhere: or(
        lt(t.createdAt, expiredBefore),
        and(
          isNull(t.status),
          lt(t.createdAt, staleBefore),
          eq(t.requestHash, sql`excluded.request_hash`)
        )
      ),
    })
    .returning({ owner: t.owner })
    .then((rows) => rows.length > 0)
}

export function getKey(ex: Executor, owner: string, key: string) {
  return ex
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.owner, owner), eq(idempotencyKeys.key, key)))
    .then((rows) => rows[0] ?? null)
}

// `createdAt` pins the claim, so a request that lost its key to a takeover
// never writes over the new owner's row.
function claimed({ owner, key, createdAt }: Id) {
  return and(
    eq(idempotencyKeys.owner, owner),
    eq(idempotencyKeys.key, key),
    eq(idempotencyKeys.createdAt, createdAt)
  )
}

export async function updateKeyResponse(
  ex: Executor,
  id: Id,
  response: { status: number; body: unknown }
) {
  await ex
    .update(idempotencyKeys)
    .set({ status: response.status, responseBody: response.body })
    .where(claimed(id))
}

export async function deleteKey(ex: Executor, id: Id) {
  await ex.delete(idempotencyKeys).where(claimed(id))
}

/** Deletes up to `size` keys written before `before`: past their 24 hours nobody can replay them. */
export function deleteOldKeys(
  ex: Executor,
  batch: { before: Date; size: number }
) {
  const target = {
    table: idempotencyKeys,
    where: lt(idempotencyKeys.createdAt, batch.before),
  }
  return deleteBatch(ex, target, batch.size)
}
