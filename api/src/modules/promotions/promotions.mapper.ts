import type {
  Promotion,
  PromotionPrice,
} from "@sayaratak/shared/schemas/billing"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"

import type { PromotionRow } from "./promotions.tables"

export function toPromotion(row: PromotionRow): Promotion {
  return {
    id: row.id,
    listingId: row.listingId,
    type: row.type,
    status: row.status,
    durationDays: row.durationDays,
    startsAt: row.startsAt?.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    source: row.source,
    paymentId: row.paymentId ?? undefined,
  }
}

export function toPromotionPrice(row: PromotionPrice): PromotionPrice {
  return {
    id: row.id,
    type: row.type,
    durationDays: row.durationDays,
    price: row.price,
  }
}

/**
 * A promotion with its listing card and payment state. One running past its
 * end reads as ended before the job marks it (A10). Only a paid one has a
 * price; a grant or a credit is free.
 */
export function toMyPromotion(
  row: PromotionRow,
  more: {
    now: Date
    listing: MyPromotion["listing"]
    price: number | null
    paymentStatus: MyPromotion["paymentStatus"]
  }
): MyPromotion {
  const over = row.status === "active" && (row.endsAt ?? more.now) < more.now
  return {
    ...toPromotion(row),
    status: over ? "ended" : row.status,
    listing: more.listing,
    price: row.source === "paid" ? (more.price ?? 0) : 0,
    paymentStatus: more.paymentStatus,
  }
}
