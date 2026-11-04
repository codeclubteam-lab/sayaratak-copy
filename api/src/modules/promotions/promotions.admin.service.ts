import type { MyPromotion } from "@sayaratak/shared/schemas/responses"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import {
  bumpListing,
  getListingHead,
} from "~/modules/listings/listings.service"
import { listCards } from "~/modules/listings/listings.stats.service"
import { getPromotionPaymentStatuses } from "~/modules/payments/payments.service"

import * as admin from "./promotions.admin.queries"
import type { PromotionRow } from "./promotions.admin.queries"
import { toMyPromotion, toPromotionPrice } from "./promotions.mapper"
import * as q from "./promotions.queries"
import { runOf } from "./promotions.service"

const PAGE_SIZE = { default: 20, max: 100 }
const ID_PREFIX = "promo"

/** Raw query values of `GET /admin/promotions`, read as the mock reads them. */
export type PromotionsQuery = Partial<
  Record<"status" | "q" | "page" | "pageSize" | "limit", string>
>

/** What an admin changes on a price row: the price, and the length of a Featured. */
export type PriceEdit = { price?: number; durationDays?: number }

/**
 * One page of promotions, waiting ones first then the newest start, each with
 * its listing, price and receipt state. `status` reads as the table shows it
 * (a running promotion past its end is ended). `listingIds` is the listings a
 * text search found, when the query has one.
 */
export async function listAdminPromotions(
  ex: Executor,
  query: PromotionsQuery,
  listingIds?: string[]
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const found = await admin.listForAdmin(ex, {
    status: query.status || undefined,
    listingIds,
    now: clock.now(),
    page: { offset: (page - 1) * size, size },
  })
  return {
    items: await toMyPromotions(ex, found.rows),
    total: found.total,
    page,
    pageSize: size,
  }
}

/** One promotion as the admin table shows it, or undefined. */
export async function findAdminPromotion(ex: Executor, id: string) {
  const row = await admin.getWithPrice(ex, id)
  return row && (await toMyPromotions(ex, [row]))[0]
}

/**
 * Gives a listing a promotion for free, starting now: a Featured for `days`,
 * or a bump (which only moves the listing to the top and has no length).
 * 404 for an unknown listing. Returns the new promotion's id.
 */
export async function grantPromotion(
  tx: Transaction,
  actor: Actor,
  grant: { listingId: string; type: "featured" | "bump"; days: number }
) {
  if (!(await getListingHead(tx, grant.listingId))) fail.notFound()
  const now = clock.now()
  const days = grant.type === "bump" ? 0 : grant.days
  const row = await q.insert(tx, {
    id: newId(ID_PREFIX),
    listingId: grant.listingId,
    type: grant.type,
    durationDays: days,
    source: "admin_grant",
    ...runOf({ type: grant.type, days, now }),
  })
  if (grant.type === "bump")
    await bumpListing(tx, { id: grant.listingId, at: now })
  await recordAudit(tx, actor, {
    action: "promotion.grant",
    targetType: "promotion",
    targetId: row.id,
    after: { listingId: grant.listingId, type: grant.type, days },
  })
  return row.id
}

/**
 * Ends a running promotion now: it leaves its listing at once. 404 for an
 * unknown promotion, 409 `conflict` for one that is not running (unpaid or
 * already ended).
 */
export async function endPromotion(tx: Transaction, actor: Actor, id: string) {
  const row = await admin.lockPromotion(tx, id)
  if (!row) fail.notFound()
  if (row.status !== "active") fail.conflict()
  const now = clock.now()
  const endsAt = row.endsAt && row.endsAt < now ? row.endsAt : now
  await admin.updateEnded(tx, { id, endsAt })
  await recordAudit(tx, actor, {
    action: "promotion.end",
    targetType: "promotion",
    targetId: id,
    before: { status: row.status, endsAt: row.endsAt },
    after: { status: "ended", endsAt },
  })
}

/** The price list as the admin edits it: Featured by length, then the bump. */
export async function listAdminPrices(ex: Executor) {
  return (await q.listPrices(ex)).map(toPromotionPrice)
}

/**
 * Changes what a promotion costs and, for a Featured, how long it runs. The
 * set of rows is fixed: none is added or removed. A bump has no length. 404
 * for an unknown row, 409 `conflict` when another row already has that length.
 */
export async function updatePrice(
  tx: Transaction,
  actor: Actor,
  change: { id: string; edit: PriceEdit }
) {
  const row = await admin.lockPrice(tx, change.id)
  if (!row) fail.notFound()
  const durationDays =
    row.type === "bump"
      ? row.durationDays
      : (change.edit.durationDays ?? row.durationDays)
  if (
    durationDays !== row.durationDays &&
    (await admin.getPriceByLength(tx, {
      type: row.type,
      durationDays,
      except: row.id,
    }))
  )
    fail.conflict()
  const saved = await admin.updatePrice(tx, {
    id: row.id,
    set: { price: change.edit.price ?? row.price, durationDays },
  })
  if (!saved) throw new Error("update of promotion_prices returned no row")
  await recordAudit(tx, actor, {
    action: "promotion_price.update",
    targetType: "promotion_price",
    targetId: row.id,
    before: { price: row.price, durationDays: row.durationDays },
    after: { price: saved.price, durationDays: saved.durationDays },
  })
  return toPromotionPrice(saved)
}

async function toMyPromotions(
  ex: Executor,
  rows: { promotion: PromotionRow; price: number | null }[]
): Promise<MyPromotion[]> {
  const [cards, statuses] = await Promise.all([
    listCards(ex, [...new Set(rows.map((row) => row.promotion.listingId))]),
    getPromotionPaymentStatuses(
      ex,
      rows.map((row) => row.promotion.id)
    ),
  ])
  const byListing = new Map(cards.map((card) => [card.id, card]))
  const now = clock.now()
  return rows.flatMap((row) => {
    const listing = byListing.get(row.promotion.listingId)
    if (!listing) return []
    return toMyPromotion(row.promotion, {
      now,
      listing,
      price: row.price,
      paymentStatus: statuses.get(row.promotion.id) ?? "none",
    })
  })
}
