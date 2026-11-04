import { lt } from "drizzle-orm"

import { deleteBatch } from "~/shared/db/delete-batch"
import type { Executor } from "~/shared/db/tx"

import { loginFailures, rateLimit, session, verification } from "./auth.tables"

type Batch = { before: Date; size: number }

export function deleteExpiredSessions(ex: Executor, batch: Batch) {
  const target = { table: session, where: lt(session.expiresAt, batch.before) }
  return deleteBatch(ex, target, batch.size)
}

/** Emailed codes and reset links whose time is up. */
export function deleteExpiredVerifications(ex: Executor, batch: Batch) {
  const target = {
    table: verification,
    where: lt(verification.expiresAt, batch.before),
  }
  return deleteBatch(ex, target, batch.size)
}

/** Request counters whose last request was before `before` (their window is long over). */
export function deleteOldRateLimits(ex: Executor, batch: Batch) {
  const target = {
    table: rateLimit,
    where: lt(rateLimit.lastRequest, batch.before.getTime()),
  }
  return deleteBatch(ex, target, batch.size)
}

export function deleteOldLoginFailures(ex: Executor, batch: Batch) {
  const target = {
    table: loginFailures,
    where: lt(loginFailures.failedAt, batch.before),
  }
  return deleteBatch(ex, target, batch.size)
}
