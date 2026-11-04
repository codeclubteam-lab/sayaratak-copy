import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import {
  verificationDocuments,
  verificationRequests,
} from "./verification.tables"

export type RequestRow = typeof verificationRequests.$inferSelect
export type NewRequestRow = typeof verificationRequests.$inferInsert
export type NewDocumentRow = typeof verificationDocuments.$inferInsert

export function countPending(ex: Executor) {
  return ex.$count(
    verificationRequests,
    eq(verificationRequests.status, "pending")
  )
}

/** The owner's newest request, whatever its state. */
export function getLatestOf(ex: Executor, ownerId: string) {
  return ex
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.ownerId, ownerId))
    .orderBy(
      desc(verificationRequests.createdAt),
      desc(verificationRequests.id)
    )
    .limit(1)
    .then(([row]) => row)
}

/** Whether the business already has a request waiting for an admin. */
export function hasPendingFor(
  ex: Executor,
  business: Pick<RequestRow, "targetType" | "targetId">
) {
  return ex
    .select({ id: verificationRequests.id })
    .from(verificationRequests)
    .where(
      and(
        eq(verificationRequests.targetType, business.targetType),
        eq(verificationRequests.targetId, business.targetId),
        eq(verificationRequests.status, "pending")
      )
    )
    .limit(1)
    .then((rows) => rows.length > 0)
}

/** Adds the request unless the business got a pending one meanwhile (the unique index); then `undefined`. */
export function insertIfNone(ex: Executor, row: NewRequestRow) {
  return ex
    .insert(verificationRequests)
    .values(row)
    .onConflictDoNothing()
    .returning()
    .then(([inserted]) => inserted)
}

export function insertDocuments(ex: Executor, rows: NewDocumentRow[]) {
  return ex.insert(verificationDocuments).values(rows)
}

/** The documents of these requests, in the order they were sent. */
export function listDocuments(ex: Executor, requestIds: string[]) {
  return ex
    .select()
    .from(verificationDocuments)
    .where(inArray(verificationDocuments.requestId, requestIds))
    .orderBy(
      asc(verificationDocuments.requestId),
      asc(verificationDocuments.position)
    )
}

/** The admin queue's filters as the mock reads them; empty means not set. */
export type AdminFilters = {
  /** Compared as text: an unknown status matches nothing instead of failing the enum cast. */
  status?: string
  id?: string
  /** With a text search: the requests of these businesses or of these owners. */
  search?: { targetIds: string[]; ownerIds: string[] }
  page: { offset: number; size: number }
}

/** One page of requests with the total, newest first, ties in the mock's id order. */
export async function listForAdmin(ex: Executor, find: AdminFilters) {
  const where = and(
    find.status
      ? sql`${verificationRequests.status}::text = ${find.status}`
      : undefined,
    find.id ? eq(verificationRequests.id, find.id) : undefined,
    find.search
      ? or(
          inArray(verificationRequests.targetId, [
            ...find.search.targetIds,
            "",
          ]),
          inArray(verificationRequests.ownerId, [...find.search.ownerIds, ""])
        )
      : undefined
  )
  const rows = await ex
    .select({
      request: verificationRequests,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(verificationRequests)
    .where(where)
    .orderBy(
      desc(verificationRequests.createdAt),
      asc(sql`length(${verificationRequests.id})`),
      asc(verificationRequests.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(verificationRequests, where))
  return { rows: rows.map((row) => row.request), total }
}

/** The request, held until the transaction ends: two admins deciding on it act one after the other. */
export function lockRequest(tx: Transaction, id: string) {
  return tx
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, id))
    .for("update")
    .then(([row]) => row)
}

export function updateDecision(
  tx: Transaction,
  change: {
    id: string
    status: "approved" | "rejected"
    rejectionReason: string | null
  }
) {
  return tx
    .update(verificationRequests)
    .set({ status: change.status, rejectionReason: change.rejectionReason })
    .where(eq(verificationRequests.id, change.id))
}
