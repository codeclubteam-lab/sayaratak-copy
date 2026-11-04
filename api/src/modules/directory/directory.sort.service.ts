import type { Rating } from "@sayaratak/shared/schemas/review"

import { haversineKm } from "~/shared/geo/distance"

type Row = { id: string; createdAt: Date }
type Compare<T> = (a: T, b: T) => number
type Ratings = Map<string, Rating>

const NO_RATING = { avg: 0, count: 0 }

/**
 * Dealership order: `rating` (the default, also for an unknown `sort`),
 * `listings` (inventory) or `newest`. Ties keep the order the rows came in,
 * which is the mock's stable sort over its array.
 */
export function sortDealerships<T extends Row & { ownerUserId: string }>(
  rows: T[],
  by: { sort?: string; ratings: Ratings; inventory: Map<string, number> }
) {
  const inventoryOf = (row: T) => by.inventory.get(row.ownerUserId) ?? 0
  return [...rows].sort(
    chosen(by.sort, {
      rating: byRating(by.ratings),
      listings: (a, b) => inventoryOf(b) - inventoryOf(a),
      newest: byNewest,
    })
  )
}

/** Workshop order: `rating` (default), `newest` or `nearest` to `from`; a workshop with no pin is last. */
export function sortWorkshops<
  T extends Row & { lat: number | null; lng: number | null },
>(
  rows: T[],
  by: { sort?: string; ratings: Ratings; from: { lat: number; lng: number } }
) {
  // 0 is "not given", as in the mock: a point on the equator or the meridian is never "nearest".
  const origin = by.from.lat && by.from.lng ? by.from : null
  const km = (row: T) =>
    origin && row.lat !== null && row.lng !== null
      ? haversineKm(origin, { lat: row.lat, lng: row.lng })
      : Number.POSITIVE_INFINITY
  return [...rows].sort(
    chosen(by.sort, {
      rating: byRating(by.ratings),
      newest: byNewest,
      // Infinity minus Infinity is NaN, which sort reads as a tie.
      nearest: (a, b) => km(a) - km(b),
    })
  )
}

/**
 * Mechanic order: `rating` (default), `experience` or `newest`, then paid
 * plans first in every order (Plus promises "Top of search"). Both sorts are
 * stable, so the first order survives inside each group.
 */
export function sortMechanics<
  T extends Row & { ownerUserId: string; yearsOfExperience: number },
>(
  rows: T[],
  by: { sort?: string; ratings: Ratings; paidOwnerIds: Set<string> }
) {
  const ordered = [...rows].sort(
    chosen(by.sort, {
      rating: byRating(by.ratings),
      experience: (a, b) => b.yearsOfExperience - a.yearsOfExperience,
      newest: byNewest,
    })
  )
  const paid = (row: T) => Number(by.paidOwnerIds.has(row.ownerUserId))
  return ordered.sort((a, b) => paid(b) - paid(a))
}

// Best average first, then most reviews.
function byRating<T extends Row>(ratings: Ratings): Compare<T> {
  const of = (row: T) => ratings.get(row.id) ?? NO_RATING
  return (a, b) => of(b).avg - of(a).avg || of(b).count - of(a).count
}

function byNewest<T extends Row>(a: T, b: T) {
  return b.createdAt.getTime() - a.createdAt.getTime()
}

// An unknown `sort` falls back to rating, as the mock does.
function chosen<T>(
  sort: string | undefined,
  sorts: { rating: Compare<T> } & Record<string, Compare<T>>
) {
  return sort && Object.hasOwn(sorts, sort)
    ? (sorts[sort] ?? sorts.rating)
    : sorts.rating
}
