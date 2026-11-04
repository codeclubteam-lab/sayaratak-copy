import { and, asc, eq, isNull, notInArray, or } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { listings } from "./listings.tables"

/** The pages search engines may index: approved, available, owner not hidden. */
export function listIndexable(ex: Executor, hiddenOwnerIds: string[]) {
  return ex
    .select({
      slug: listings.slug,
      updatedAt: listings.updatedAt,
      kind: listings.kind,
      vehicleType: listings.vehicleType,
      intent: listings.intent,
      cityId: listings.cityId,
    })
    .from(listings)
    .where(
      and(
        eq(listings.moderation, "approved"),
        eq(listings.status, "available"),
        hiddenOwnerIds.length > 0
          ? or(
              isNull(listings.ownerUserId),
              notInArray(listings.ownerUserId, hiddenOwnerIds)
            )
          : undefined
      )
    )
    .orderBy(asc(listings.id))
}
