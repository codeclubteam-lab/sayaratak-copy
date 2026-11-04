import type { Range } from "@sayaratak/shared/schemas/api"
import type { AdminStats } from "@sayaratak/shared/schemas/responses"

import { db } from "~/shared/db/client"
import { daysUpTo } from "~/shared/time/khartoum"
import { windowsOf } from "~/modules/analytics/analytics.service"
import * as users from "~/modules/auth/auth.overview.service"
import * as businesses from "~/modules/businesses/businesses.overview.service"
import * as listings from "~/modules/listings/listings.overview.service"
import * as payments from "~/modules/payments/payments.service"
import * as plans from "~/modules/plans/plans.service"

/**
 * `GET /admin/stats`: the dashboard totals and three daily series over the
 * last 7, 30 or 90 Khartoum days, today included. Revenue counts approved
 * payments on the day they were decided, so its total is the sum of its series.
 * Example: `7d` on 2026-11-01 reads 2026-10-26 to 2026-11-01, seven points each.
 */
export async function getStats(range: Range): Promise<AdminStats> {
  const { length, current } = windowsOf(range)
  const [count, perDay] = await Promise.all([
    readCounts(),
    Promise.all([
      listings.countCreatedPerDay(db, current),
      users.countUsersPerDay(db, current),
      payments.sumApprovedPerDay(db, current),
    ]),
  ])
  const days = daysUpTo(current.last, length)
  const [newListings, newUsers, revenue] = perDay.map((counts) =>
    days.map((date) => ({ date, value: counts.get(date) ?? 0 }))
  )
  const revenueSeries = revenue ?? []
  return {
    range,
    totals: {
      ...count,
      revenue: revenueSeries.reduce((sum, point) => sum + point.value, 0),
    },
    series: {
      newListings: newListings ?? [],
      newUsers: newUsers ?? [],
      revenue: revenueSeries,
    },
  }
}

async function readCounts() {
  // Independent reads.
  const [userCount, approved, profiles, activeSubscriptions] =
    await Promise.all([
      users.countUsers(db),
      listings.countApproved(db),
      businesses.countBusinesses(db),
      plans.countActiveSubscriptions(db),
    ])
  return { users: userCount, ...approved, ...profiles, activeSubscriptions }
}
