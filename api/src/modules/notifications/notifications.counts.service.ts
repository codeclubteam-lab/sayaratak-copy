import type { Counts } from "@sayaratak/shared/schemas/api"

import { db } from "~/shared/db/client"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as listings from "~/modules/listings/listings.service"
import * as messaging from "~/modules/messaging/messaging.service"
import * as payments from "~/modules/payments/payments.service"
import * as reports from "~/modules/reports/reports.service"
import * as reviews from "~/modules/reviews/reviews.service"
import * as verification from "~/modules/verification/verification.service"

import * as q from "./notifications.queries"

/**
 * The badges in the header and the dashboard menu: unread messages and
 * notifications for everyone, plus the queue sizes for an admin.
 */
export async function getCounts(user: SessionUser): Promise<Counts> {
  const [unreadMessages, unreadNotifications] = await Promise.all([
    messaging.countUnreadMessages(db, user.id),
    q.countUnread(db, user.id),
  ])
  const base = { unreadMessages, unreadNotifications }
  if (user.role !== "admin") return base
  const [
    pendingListings,
    pendingPayments,
    pendingVerifications,
    openReports,
    flaggedReviews,
  ] = await Promise.all([
    listings.countPendingListings(db),
    payments.countPendingPayments(db),
    verification.countPendingVerifications(db),
    reports.countOpenReports(db),
    reviews.countFlaggedReviews(db),
  ])
  return {
    ...base,
    pendingListings,
    pendingPayments,
    pendingVerifications,
    openReports,
    flaggedReviews,
  }
}
