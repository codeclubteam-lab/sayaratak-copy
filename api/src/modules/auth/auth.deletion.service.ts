import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import * as analytics from "~/modules/analytics/analytics.service"
import * as businesses from "~/modules/businesses/businesses.service"
import * as listings from "~/modules/listings/listings.service"
import * as messaging from "~/modules/messaging/messaging.service"
import * as payments from "~/modules/payments/payments.service"
import * as reviews from "~/modules/reviews/reviews.service"

import { auth } from "./auth.config"
import * as q from "./auth.queries"
import type { SessionUser } from "./auth.types"

/**
 * Deletes the account for real, which frees the email (A2 "Account
 * deletion", the mock's `removeAccount`). Listings stay, marked removed;
 * pending receipts are rejected; the business with its reviews and counters,
 * threads, and everything else the user owns go. Rows that stay point at
 * nobody (`ON DELETE SET NULL`); the rest cascade, sessions included.
 * Admins cannot delete themselves. Returns the headers that clear the cookie.
 */
export async function deleteAccount(
  user: SessionUser,
  requestHeaders: Headers
) {
  if (user.role === "admin") fail.forbidden()
  await transaction(async (tx) => {
    await listings.removeListingsOf(tx, user.id)
    await payments.rejectPendingOf(tx, user.id)
    const businessId = await businesses.getBusinessIdOf(tx, user.id)
    if (businessId) {
      await reviews.deleteReviewsOf(tx, businessId)
      await analytics.deleteEventsOf(tx, businessId)
    }
    await messaging.deleteThreadsOf(tx, user.id)
    await q.deleteUser(tx, user.id)
  })
  // The session row is already gone with the user; this only clears the cookie.
  const { headers } = await auth.api.signOut({
    headers: requestHeaders,
    returnHeaders: true,
  })
  return headers
}
