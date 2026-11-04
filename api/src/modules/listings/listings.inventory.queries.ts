import { and, count, eq, inArray } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { listings } from "./listings.tables"

/** Approved listings still for sale, per owner (a dealership's inventory). */
export function countAvailableByOwner(ex: Executor, ownerUserIds: string[]) {
  if (ownerUserIds.length === 0) return Promise.resolve([])
  return ex
    .select({ ownerUserId: listings.ownerUserId, count: count() })
    .from(listings)
    .where(
      and(
        inArray(listings.ownerUserId, ownerUserIds),
        eq(listings.moderation, "approved"),
        eq(listings.status, "available")
      )
    )
    .groupBy(listings.ownerUserId)
}
