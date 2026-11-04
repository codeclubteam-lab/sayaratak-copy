import type { promotionInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import { getListingHead } from "~/modules/listings/listings.service"
import * as plans from "~/modules/plans/plans.service"

import { toPromotion, toPromotionPrice } from "./promotions.mapper"
import * as q from "./promotions.queries"

const ID_PREFIX = "promo"
const DAY_MS = 86_400_000
// A Featured credit buys one 7-day Featured.
const CREDIT_DAYS = 7
// A listing can be bumped again a day after its last bump.
const BUMP_WAIT_MS = 24 * 3_600_000

/** `GET /promotion-prices`: Featured by length, then the bump. */
export async function listPromotionPrices() {
  return (await q.listPrices(db)).map(toPromotionPrice)
}

/**
 * `POST /promotions`: orders a promotion for one of the caller's own listings.
 * A credit starts a 7-day Featured at once; a price row makes an unpaid order
 * that the admin's approval of its payment starts (8.6). Asking again for the
 * same listing and price returns the unpaid order. 404 for an unknown listing
 * or price, 403 for someone else's listing, 409 `no_credits`, 409 `bump_wait`.
 */
export async function orderPromotion(
  user: SessionUser,
  input: z.output<typeof promotionInputSchema>
) {
  const listing = await getListingHead(db, input.listingId)
  if (!listing) fail.notFound()
  if (listing.ownerUserId !== user.id) fail.forbidden()
  if (input.useCredit) return useCredit(user, input.listingId)
  const price = await q.getPriceRow(db, input.priceId ?? "")
  if (!price) fail.notFound()
  const bumped = listing.bumpedAt?.getTime()
  if (
    price.type === "bump" &&
    bumped !== undefined &&
    clock.now().getTime() - bumped < BUMP_WAIT_MS
  )
    fail.conflict("bump_wait")
  const order = {
    listingId: input.listingId,
    type: price.type,
    durationDays: price.durationDays,
  }
  // The unpaid-order index decides a tie between two orders sent together.
  const saved =
    (await q.insertIfNone(db, {
      ...order,
      id: newId(ID_PREFIX),
      status: "pending_payment",
      source: "paid",
    })) ?? (await q.getUnpaid(db, order))
  // The other order was approved between the two statements: ask again.
  if (!saved) fail.conflict()
  return toPromotion(saved)
}

// One account's credit orders queue on its row, so the last credit is spent once.
function useCredit(user: SessionUser, listingId: string) {
  return transaction(async (tx) => {
    await auth.lockUser(tx, user.id)
    const credits = await plans.getCreditsOf(tx, user.id)
    if (credits.left < 1) fail.conflict("no_credits")
    const now = clock.now()
    const saved = await q.insert(tx, {
      id: newId(ID_PREFIX),
      listingId,
      type: "featured",
      status: "active",
      durationDays: CREDIT_DAYS,
      startsAt: now,
      endsAt: new Date(now.getTime() + CREDIT_DAYS * DAY_MS),
      source: "credit",
    })
    return toPromotion(saved)
  })
}
