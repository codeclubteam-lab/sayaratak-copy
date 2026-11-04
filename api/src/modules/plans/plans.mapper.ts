import type { Plan, Subscription } from "@sayaratak/shared/schemas/billing"

import type { PlanRow, SubscriptionRow } from "./plans.tables"

export function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    audience: row.audience,
    name: row.name,
    price: row.price,
    durationDays: row.durationDays,
    listingLimit: row.listingLimit ?? undefined,
    serviceLimit: row.serviceLimit ?? undefined,
    photoLimit: row.photoLimit ?? undefined,
    portfolioLimit: row.portfolioLimit ?? undefined,
    features: row.features,
    featuredCredits: row.featuredCredits,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  }
}

/** `used` is counted from the owner's live listings, not stored. */
export function toSubscription(
  row: SubscriptionRow,
  used: number
): Subscription {
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    price: row.price,
    usage: { used, limit: row.listingLimit },
    note: row.note ?? undefined,
  }
}
