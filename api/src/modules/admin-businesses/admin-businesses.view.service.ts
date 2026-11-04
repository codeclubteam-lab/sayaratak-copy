import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import type { Rating } from "@sayaratak/shared/schemas/review"

import type { Executor } from "~/shared/db/tx"
import { both } from "~/shared/text/bilingual"
import * as auth from "~/modules/auth/auth.service"
import type { AdminBusinessRow } from "~/modules/businesses/businesses.admin.service"
import type { BusinessKind } from "~/modules/businesses/businesses.types"
import * as listings from "~/modules/listings/listings.overview.service"
import * as plans from "~/modules/plans/plans.service"
import * as reviews from "~/modules/reviews/reviews.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

const NO_RATING: Rating = { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] }

type Gathered = Awaited<ReturnType<typeof gather>>

/**
 * The admin table rows of these businesses, each with its owner, rating,
 * picture, plan and (dealerships) live listings, every part read from its own module.
 * A business with no subscription shows its audience's free plan (A9).
 */
export async function toViews(
  ex: Executor,
  rows: AdminBusinessRow[]
): Promise<AdminBusiness[]> {
  const found = await gather(ex, rows)
  return rows.map((row) => viewOf(row, found))
}

async function gather(ex: Executor, rows: AdminBusinessRow[]) {
  const ownerIds = rows.map((row) => row.ownerUserId)
  const dealerOwnerIds = rows
    .filter((row) => row.kind === "dealership")
    .map((row) => row.ownerUserId)
  const kinds = new Set(rows.map((row) => row.kind))
  // Independent reads.
  const [owners, ratings, media, subs, live, free] = await Promise.all([
    auth.listUsers(ex, ownerIds),
    reviews.getRatingSummaries(
      ex,
      rows.map((row) => row.id)
    ),
    uploads.getMediaOf(
      ex,
      rows.flatMap((row) => (row.imageUploadId ? [row.imageUploadId] : []))
    ),
    plans.getActiveSubscriptions(ex, ownerIds),
    listings.countLivePerOwner(ex, dealerOwnerIds),
    freePlansOf(ex, kinds),
  ])
  const planOf = await plans.getPlans(
    ex,
    [...subs.values()].map((sub) => sub.planId)
  )
  return {
    owners: new Map(owners.map((owner) => [owner.id, owner])),
    ratings,
    media,
    subs,
    live,
    free,
    planOf,
  }
}

async function freePlansOf(ex: Executor, kinds: Set<BusinessKind>) {
  const found = await Promise.all(
    [...kinds].map(
      async (kind) => [kind, await plans.getFreePlan(ex, kind)] as const
    )
  )
  return new Map(found)
}

function viewOf(row: AdminBusinessRow, found: Gathered): AdminBusiness {
  const image = row.imageUploadId ? found.media.get(row.imageUploadId) : null
  const dealer = row.kind === "dealership"
  const owner = found.owners.get(row.ownerUserId)
  const used = dealer ? (found.live.get(row.ownerUserId) ?? 0) : 0
  return {
    id: row.id,
    type: row.kind,
    name: row.name,
    slug: row.slug,
    imageUrl: image?.url ?? "",
    cityId: row.cityId,
    phone: row.phone,
    whatsapp: row.whatsapp,
    ownerId: row.ownerUserId,
    owner: owner ? auth.toOwnerContact(owner) : null,
    verified: row.verified,
    status: row.status,
    ...(row.suspendedReason !== null && {
      suspendedReason: row.suspendedReason,
    }),
    rating: found.ratings.get(row.id) ?? NO_RATING,
    listings: dealer ? used : null,
    plan: planOf(row, found, used),
    createdAt: row.createdAt.toISOString(),
  }
}

// The active subscription's price and limit, else the audience's free plan with no end.
function planOf(row: AdminBusinessRow, found: Gathered, used: number) {
  const sub = found.subs.get(row.ownerUserId)
  const plan = sub ? found.planOf.get(sub.planId) : found.free.get(row.kind)
  return {
    id: plan?.id ?? "",
    name: plan?.name ?? both(""),
    price: sub?.price ?? plan?.price ?? 0,
    endsAt: sub?.endsAt.toISOString() ?? null,
    used,
    limit: sub ? sub.listingLimit : null,
    ...(sub?.note != null && { note: sub.note }),
  }
}
