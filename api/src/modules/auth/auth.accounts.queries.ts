import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { account, user } from "./auth.tables"

export function lockUser(ex: Executor, id: string) {
  return ex
    .select()
    .from(user)
    .where(eq(user.id, id))
    .for("update")
    .then(([row]) => row)
}

export function listUsers(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex.select().from(user).where(inArray(user.id, ids))
}

/** Ids of accounts banned at `now`: a permanent ban, or a timed one not yet over. */
export function listBannedIds(ex: Executor, now: Date) {
  return ex
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.banned, true),
        or(isNull(user.banExpires), gt(user.banExpires, now))
      )
    )
    .then((rows) => rows.map((row) => row.id))
}

/** Clears the ban of up to `size` accounts whose timed ban is over at `now`; answers how many. */
export function updateBansLifted(
  ex: Executor,
  batch: { now: Date; size: number }
) {
  const due = ex
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.banned, true),
        isNotNull(user.banExpires),
        lte(user.banExpires, batch.now)
      )
    )
    .limit(batch.size)
    .for("update", { skipLocked: true })
  return ex
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null })
    .where(inArray(user.id, due))
    .returning({ id: user.id })
    .then((rows) => rows.length)
}

/**
 * Deletes up to `size` sign-ups that never finished: a person account created before `before`
 * whose email was never verified and that has no social login. The same accounts `existingSignUp`
 * replaces when the email signs up again. Answers how many it deleted.
 */
export function deleteUnfinishedSignUps(
  ex: Executor,
  batch: { before: Date; size: number }
) {
  const due = ex
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        eq(user.emailVerified, false),
        eq(user.role, "user"),
        lt(user.createdAt, batch.before),
        notExists(
          ex
            .select({ id: account.id })
            .from(account)
            .where(
              and(
                eq(account.userId, user.id),
                sql`${account.providerId} <> 'credential'`
              )
            )
        )
      )
    )
    .limit(batch.size)
    .for("update", { skipLocked: true })
  return ex
    .delete(user)
    .where(inArray(user.id, due))
    .returning({ id: user.id })
    .then((rows) => rows.length)
}

export function listPhoneVerifiedIds(ex: Executor) {
  return ex
    .select({ id: user.id })
    .from(user)
    .where(eq(user.verifiedPhone, true))
    .then((rows) => rows.map((row) => row.id))
}

/** Ids of accounts whose name holds `term` (already lower case). */
export function listIdsNamed(ex: Executor, term: string) {
  return ex
    .select({ id: user.id })
    .from(user)
    .where(sql`strpos(lower(${user.name}), ${term}) > 0`)
    .then((rows) => rows.map((row) => row.id))
}
