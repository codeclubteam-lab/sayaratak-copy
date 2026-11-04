import type { ActivityItem } from "@sayaratak/shared/schemas/responses"

import { db } from "~/shared/db/client"
import { both } from "~/shared/text/bilingual"
import * as businesses from "~/modules/businesses/businesses.overview.service"
import * as listings from "~/modules/listings/listings.overview.service"
import * as payments from "~/modules/payments/payments.service"
import * as reports from "~/modules/reports/reports.service"

import {
  toBusinessActivity,
  toListingActivity,
  toPaymentActivity,
  toReportActivity,
} from "./admin.mapper"

const FEED_LENGTH = 10

/**
 * `GET /admin/activity`: the ten newest things that happened on the site: a
 * listing sent in, a business that joined, a receipt sent, a report filed. Each
 * source gives its own ten newest, then the lists are merged. On the same
 * instant the order is listings, businesses, payments, reports, as in the mock.
 */
export async function getActivity() {
  // Four independent reads.
  const [submitted, joined, receipts, filed] = await Promise.all([
    listings.listNewestSubmitted(db, FEED_LENGTH),
    businesses.listNewestJoined(db, FEED_LENGTH),
    payments.listNewestPayments(db, FEED_LENGTH),
    reports.listNewestReports(db, FEED_LENGTH),
  ])
  const feed: ActivityItem[] = [
    ...submitted.map((row) => toListingActivity(row, both(row.title))),
    ...joined.map(toBusinessActivity),
    ...receipts.map((row) => toPaymentActivity(row, both(row.reference))),
    ...filed.map((row) => toReportActivity(row, both(row.label))),
  ]
  // ISO strings of the same length sort the same as the instants they name.
  const newestFirst = feed.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
  return { items: newestFirst.slice(0, FEED_LENGTH) }
}
