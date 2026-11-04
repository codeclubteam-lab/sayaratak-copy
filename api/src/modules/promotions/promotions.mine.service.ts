import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import { listCards } from "~/modules/listings/listings.stats.service"
import { listIdsOf } from "~/modules/listings/listings.stats.service"
import { getPromotionPaymentStatuses } from "~/modules/payments/payments.service"

import { toMyPromotion } from "./promotions.mapper"
import * as q from "./promotions.queries"

/**
 * `GET /me/promotions`: every promotion of the caller's listings with the
 * listing card, the price and the state of its newest receipt. Waiting ones
 * first, then the newest start.
 */
export async function listMyPromotions(user: SessionUser) {
  const rows = await q.listOfListings(db, await listIdsOf(db, user.id))
  const ids = rows.map((row) => row.promotion.id)
  const [cards, statuses] = await Promise.all([
    listCards(db, [...new Set(rows.map((row) => row.promotion.listingId))]),
    getPromotionPaymentStatuses(db, ids),
  ])
  const byListing = new Map(cards.map((card) => [card.id, card]))
  const now = clock.now()
  const items = rows.flatMap((row) => {
    const listing = byListing.get(row.promotion.listingId)
    if (!listing) return []
    return toMyPromotion(row.promotion, {
      now,
      listing,
      price: row.price,
      paymentStatus: statuses.get(row.promotion.id) ?? "none",
    })
  })
  return { items }
}
