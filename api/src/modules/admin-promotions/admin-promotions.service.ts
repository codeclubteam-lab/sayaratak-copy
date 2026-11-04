import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { Actor } from "~/modules/audit/audit.types"
import * as listings from "~/modules/listings/listings.overview.service"
import * as promotions from "~/modules/promotions/promotions.admin.service"

/** `GET /admin/promotion-prices`: the price rows. */
export function getAdminPrices() {
  return promotions.listAdminPrices(db)
}

/** `PATCH /admin/promotion-prices/:id`: the row as it is after. */
export function updatePrice(
  actor: Actor,
  change: { id: string; edit: promotions.PriceEdit }
) {
  return transaction((tx) => promotions.updatePrice(tx, actor, change))
}

/** `GET /admin/promotions`: promotions waiting first, then the newest start, with their listing and receipt state. */
export async function getAdminPromotions(query: promotions.PromotionsQuery) {
  return promotions.listAdminPromotions(
    db,
    query,
    await listingsTitled(query.q)
  )
}

/** `POST /admin/promotions/grant`: the new promotion, running from now. */
export function grant(
  actor: Actor,
  input: { listingId: string; type: "featured" | "bump"; days: number }
) {
  return transaction(async (tx) => {
    const id = await promotions.grantPromotion(tx, actor, input)
    return viewOne(tx, id)
  })
}

/** `POST /admin/promotions/:id/end`: the promotion as it is after; its listing loses it at once. */
export function end(actor: Actor, id: string) {
  return transaction(async (tx) => {
    await promotions.endPromotion(tx, actor, id)
    return viewOne(tx, id)
  })
}

// The text search reads the listing title; the listings module finds its own ids.
async function listingsTitled(text: string | undefined) {
  const term = text?.trim().toLowerCase()
  return term ? await listings.listIdsTitled(db, term) : undefined
}

async function viewOne(ex: Executor, id: string) {
  const view = await promotions.findAdminPromotion(ex, id)
  if (!view) fail.notFound()
  return view
}
