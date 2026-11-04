import { and, asc, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import {
  type NewPromotionRow,
  promotionPrices,
  promotions,
} from "./promotions.tables"

export function updateEndedFor(
  ex: Executor,
  change: { listingIds: string[]; at: Date }
) {
  return ex
    .update(promotions)
    .set({ status: "ended", endsAt: change.at })
    .where(
      and(
        inArray(promotions.listingId, change.listingIds),
        eq(promotions.status, "active")
      )
    )
}

export function listRunning(
  ex: Executor,
  scope: { listingIds: string[]; now: Date }
) {
  return ex
    .select({
      listingId: promotions.listingId,
      type: promotions.type,
      startsAt: promotions.startsAt,
      endsAt: promotions.endsAt,
    })
    .from(promotions)
    .where(
      and(
        inArray(promotions.listingId, scope.listingIds),
        eq(promotions.status, "active"),
        ne(promotions.type, "bump"),
        gt(promotions.endsAt, scope.now)
      )
    )
    .orderBy(asc(promotions.startsAt))
}

export function listFeaturedIds(ex: Executor, now: Date) {
  return ex
    .selectDistinct({ id: promotions.listingId })
    .from(promotions)
    .where(
      and(
        eq(promotions.type, "featured"),
        eq(promotions.status, "active"),
        lte(promotions.startsAt, now),
        gte(promotions.endsAt, now)
      )
    )
    .then((rows) => rows.map((row) => row.id))
}

/** Credit promotions of these listings that started at or after `since`. */
export function countCreditsSince(
  ex: Executor,
  scope: { listingIds: string[]; since: Date }
) {
  if (scope.listingIds.length === 0) return Promise.resolve(0)
  return ex.$count(
    promotions,
    and(
      inArray(promotions.listingId, scope.listingIds),
      eq(promotions.source, "credit"),
      gte(promotions.startsAt, scope.since)
    )
  )
}

export function getPromotion(ex: Executor, id: string) {
  return ex
    .select({
      id: promotions.id,
      listingId: promotions.listingId,
      type: promotions.type,
      status: promotions.status,
      durationDays: promotions.durationDays,
    })
    .from(promotions)
    .where(eq(promotions.id, id))
    .then(([row]) => row)
}

export function getPrice(
  ex: Executor,
  of: { type: "featured" | "bump"; durationDays: number }
) {
  return ex
    .select({ price: promotionPrices.price })
    .from(promotionPrices)
    .where(
      and(
        eq(promotionPrices.type, of.type),
        eq(promotionPrices.durationDays, of.durationDays)
      )
    )
    .then(([row]) => row?.price)
}

/** Featured by length, then the bump: the order of the price list. */
export function listPrices(ex: Executor) {
  return ex
    .select()
    .from(promotionPrices)
    .orderBy(asc(promotionPrices.type), asc(promotionPrices.durationDays))
}

export function getPriceRow(ex: Executor, id: string) {
  return ex
    .select()
    .from(promotionPrices)
    .where(eq(promotionPrices.id, id))
    .then(([row]) => row)
}

/** Null when the unpaid-order index already holds one for that listing, type and length. */
export function insertIfNone(ex: Executor, row: NewPromotionRow) {
  return ex
    .insert(promotions)
    .values(row)
    .onConflictDoNothing()
    .returning()
    .then(([saved]) => saved ?? null)
}

export function insert(ex: Executor, row: NewPromotionRow) {
  return ex
    .insert(promotions)
    .values(row)
    .returning()
    .then(([inserted]) => {
      // One row in, one row back; anything else is a driver fault.
      if (!inserted) throw new Error("insert into promotions returned no row")
      return inserted
    })
}

export function getUnpaid(
  ex: Executor,
  of: { listingId: string; type: "featured" | "bump"; durationDays: number }
) {
  return ex
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.listingId, of.listingId),
        eq(promotions.type, of.type),
        eq(promotions.durationDays, of.durationDays),
        eq(promotions.status, "pending_payment")
      )
    )
    .then(([row]) => row)
}

/** The promotions of these listings with the price of their type and length (null when that row is gone): waiting ones first, then the newest start. */
export function listOfListings(ex: Executor, listingIds: string[]) {
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
    .where(inArray(promotions.listingId, listingIds))
    .orderBy(sql`${promotions.startsAt} desc nulls first`, asc(promotions.id))
}
