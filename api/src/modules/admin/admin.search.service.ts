import type { AdminSearch } from "@sayaratak/shared/schemas/responses"

import { db } from "~/shared/db/client"
import { both } from "~/shared/text/bilingual"
import * as users from "~/modules/auth/auth.overview.service"
import * as businesses from "~/modules/businesses/businesses.overview.service"
import * as listings from "~/modules/listings/listings.overview.service"
import * as payments from "~/modules/payments/payments.service"

import {
  toBusinessHit,
  toListingHit,
  toPaymentHit,
  toUserHit,
} from "./admin.mapper"

const HITS_PER_KIND = 5
const TERM_MAX_LENGTH = 100

/**
 * `GET /admin/search?q=`: up to five hits for each of listings, accounts,
 * businesses and payments, each with the admin screen that opens it. A blank
 * `q` finds nothing. Example: `q=toyota` finds listings titled "Toyota Hilux".
 */
export async function searchAdmin(q: string | undefined): Promise<AdminSearch> {
  const term = (q ?? "").trim().slice(0, TERM_MAX_LENGTH)
  if (!term) return { listings: [], users: [], businesses: [], payments: [] }
  const find = { term, limit: HITS_PER_KIND }
  // Four independent reads.
  const [foundListings, foundUsers, foundBusinesses, foundPayments] =
    await Promise.all([
      listings.searchListings(db, find),
      users.searchUsers(db, find),
      businesses.searchBusinesses(db, find),
      payments.searchPayments(db, find),
    ])
  return {
    listings: foundListings.map((row) => toListingHit(row, both(row.title))),
    users: foundUsers.map((row) => toUserHit(row, both(row.name))),
    businesses: foundBusinesses.map(toBusinessHit),
    payments: foundPayments.map((row) =>
      toPaymentHit(row, both(row.reference))
    ),
  }
}
