import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"
import { monthColumn } from "~/shared/time/khartoum"

import { type PaymentRow, payments } from "./payments.tables"

export type { PaymentRow }

/** The admin payments table's filters as the mock reads them; empty means not set. */
export type PaymentFilters = {
  /** Compared as text: an unknown status matches nothing instead of failing the enum cast. */
  status?: string
  userId?: string
  id?: string
  /** Lower case. Matches the reference, the transfer number or the item name in either language. */
  q?: string
  page: { offset: number; size: number }
}

/** One page of payments with the total, newest first, ties in the mock's id order (`pay-2` before `pay-10`). */
export async function listForAdmin(ex: Executor, find: PaymentFilters) {
  const where = and(
    find.status ? sql`${payments.status}::text = ${find.status}` : undefined,
    find.userId ? eq(payments.userId, find.userId) : undefined,
    find.id ? eq(payments.id, find.id) : undefined,
    find.q
      ? sql`strpos(lower(${payments.reference} || ' ' || ${payments.transactionRef} || ' ' || (${payments.itemLabel} ->> 'ar') || ' ' || (${payments.itemLabel} ->> 'en')), ${find.q}) > 0`
      : undefined
  )
  const rows = await ex
    .select({
      payment: payments,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(payments)
    .where(where)
    .orderBy(
      desc(payments.createdAt),
      asc(sql`length(${payments.id})`),
      asc(payments.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(payments, where))
  return { rows: rows.map((row) => row.payment), total }
}

/** The payment, held until the transaction ends: two admins deciding on one receipt act one after the other. */
export function lockPayment(tx: Transaction, id: string) {
  return tx
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .for("update")
    .then(([row]) => row)
}

/** The receipt of this item that waits for the admin, held until the transaction ends. */
export function lockUndecidedOfItem(
  tx: Transaction,
  item: { itemType: PaymentRow["itemType"]; itemId: string }
) {
  return tx
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.itemType, item.itemType),
        eq(payments.itemId, item.itemId),
        eq(payments.status, "pending_review")
      )
    )
    .for("update")
    .then(([row]) => row)
}

/** The receipts sent for these campaigns, oldest first, so the newest of a campaign comes last. */
export function listCampaignReceipts(ex: Executor, campaignIds: string[]) {
  if (campaignIds.length === 0) return Promise.resolve([])
  return ex
    .select({
      campaignId: payments.itemId,
      receiptUploadId: payments.receiptUploadId,
    })
    .from(payments)
    .where(
      and(
        eq(payments.itemType, "campaign"),
        inArray(payments.itemId, campaignIds)
      )
    )
    .orderBy(
      asc(payments.createdAt),
      asc(sql`length(${payments.id})`),
      asc(payments.id)
    )
}

export function updateDecision(
  tx: Transaction,
  change: { id: string; set: Partial<PaymentRow> }
) {
  return tx.update(payments).set(change.set).where(eq(payments.id, change.id))
}

/** Money of the payments approved in a Khartoum month (`"2026-11"`), counted on the day the admin decided (the send day if none). */
export function sumApprovedInMonth(ex: Executor, month: string) {
  return ex
    .select({
      amount: sql`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "approved"),
        sql`${monthColumn(sql`coalesce(${payments.reviewedAt}, ${payments.createdAt})`)} = ${month}`
      )
    )
    .then(([row]) => row?.amount ?? 0)
}

/** How many receipts wait for review and what they add up to. */
export function sumPending(ex: Executor) {
  return ex
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      amount: sql`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
    })
    .from(payments)
    .where(eq(payments.status, "pending_review"))
    .then(([row]) => ({ count: row?.count ?? 0, amount: row?.amount ?? 0 }))
}
