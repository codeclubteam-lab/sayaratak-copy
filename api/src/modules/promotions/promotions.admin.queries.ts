import { and, asc, eq, gte, inArray, lt, or, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import {
  type NewPromotionRow,
  type PromotionRow,
  promotionPrices,
  promotions,
} from "./promotions.tables"

export type { PromotionRow }

/** The promotion, held until the transaction ends, so two decisions on its receipt queue up. */
export function lockPromotion(tx: Transaction, id: string) {
  return tx
    .select()
    .from(promotions)
    .where(eq(promotions.id, id))
    .for("update")
    .then(([row]) => row)
}

/** The promotions with these ids: what a payment row names. */
export function listByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select({
      id: promotions.id,
      listingId: promotions.listingId,
      type: promotions.type,
      durationDays: promotions.durationDays,
    })
    .from(promotions)
    .where(inArray(promotions.id, ids))
}

export function updateStarted(
  tx: Transaction,
  change: { id: string; set: Partial<NewPromotionRow> }
) {
  return tx
    .update(promotions)
    .set(change.set)
    .where(eq(promotions.id, change.id))
}

/** The admin table's filters as the mock reads them; empty means not set. */
export type PromotionFilters = {
  /** The status as the table shows it: a running promotion past its end reads `ended`. */
  status?: string
  /** With a text search: the listings whose title matches. */
  listingIds?: string[]
  now: Date
  page: { offset: number; size: number }
}

/** One page of promotions with the price of their type and length (null when that row is gone) and the total: waiting ones first, then the newest start. */
export async function listForAdmin(ex: Executor, find: PromotionFilters) {
  const where = and(
    statusWhere(find.status, find.now),
    find.listingIds
      ? inArray(promotions.listingId, [...find.listingIds, ""])
      : undefined
  )
  const rows = await ex
    .select({
      promotion: promotions,
      price: promotionPrices.price,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(promotions)
    .leftJoin(
      promotionPrices,
      and(
        eq(promotionPrices.type, promotions.type),
        eq(promotionPrices.durationDays, promotions.durationDays)
      )
    )
    .where(where)
    .orderBy(
      sql`${promotions.startsAt} desc nulls first`,
      asc(sql`length(${promotions.id})`),
      asc(promotions.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(promotions, where))
  return {
    rows: rows.map(({ promotion, price }) => ({ promotion, price })),
    total,
  }
}

function statusWhere(status: string | undefined, now: Date) {
  if (!status) return undefined
  if (status === "ended")
    return or(
      eq(promotions.status, "ended"),
      and(eq(promotions.status, "active"), lt(promotions.endsAt, now))
    )
  if (status === "active")
    return and(eq(promotions.status, "active"), gte(promotions.endsAt, now))
  if (status === "pending_payment")
    return eq(promotions.status, "pending_payment")
  // Any other value matches nothing.
  return sql`false`
}

/** The price row, held until the transaction ends. */
export function lockPrice(tx: Transaction, id: string) {
  return tx
    .select()
    .from(promotionPrices)
    .where(eq(promotionPrices.id, id))
    .for("update")
    .then(([row]) => row)
}

/** Another price row of this type and length, if any: the pair is unique. */
export function getPriceByLength(
  ex: Executor,
  of: { type: "featured" | "bump"; durationDays: number; except: string }
) {
  return ex
    .select({ id: promotionPrices.id })
    .from(promotionPrices)
    .where(
      and(
        eq(promotionPrices.type, of.type),
        eq(promotionPrices.durationDays, of.durationDays),
        sql`${promotionPrices.id} <> ${of.except}`
      )
    )
    .then(([row]) => row)
}

export function updatePrice(
  tx: Transaction,
  change: { id: string; set: { price?: number; durationDays?: number } }
) {
  return tx
    .update(promotionPrices)
    .set(change.set)
    .where(eq(promotionPrices.id, change.id))
    .returning()
    .then(([row]) => row)
}

export function updateEnded(
  tx: Transaction,
  change: { id: string; endsAt: Date }
) {
  return tx
    .update(promotions)
    .set({ status: "ended", endsAt: change.endsAt })
    .where(eq(promotions.id, change.id))
}

/** One promotion with the price of its type and length (null when that row is gone). */
export function getWithPrice(ex: Executor, id: string) {
  return ex
    .select({ promotion: promotions, price: promotionPrices.price })
    .from(promotions)
    .leftJoin(
      promotionPrices,
      and(
        eq(promotionPrices.type, promotions.type),
        eq(promotionPrices.durationDays, promotions.durationDays)
      )
    )
    .where(eq(promotions.id, id))
    .then(([row]) => row)
}
