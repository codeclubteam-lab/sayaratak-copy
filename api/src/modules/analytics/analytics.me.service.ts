import type { Range } from "@sayaratak/shared/schemas/api"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

import { db } from "~/shared/db/client"
import { type DayRange, daysUpTo } from "~/shared/time/khartoum"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as favorites from "~/modules/favorites/favorites.service"
import * as listings from "~/modules/listings/listings.stats.service"
import * as messaging from "~/modules/messaging/messaging.service"
import * as reviews from "~/modules/reviews/reviews.service"

import { groupByDay, NO_COUNTS, sumCounts, sumDays } from "./analytics.mapper"
import * as q from "./analytics.queries"
import { windowsOf } from "./analytics.service"

const TOP_COUNT = 10

/**
 * The dashboard numbers for the signed-in account: a seller's listings, a
 * business owner's profile page, everything for an admin. `previous` is the
 * period of the same length just before, for the change on each stat card.
 */
export async function getMyAnalytics(
  user: SessionUser,
  range: Range
): Promise<Analytics> {
  const { length, current, previous } = windowsOf(range)
  const scope = await scopeOf(user)
  const found = await load({ user, scope, current, previous })
  return {
    range,
    totals: totalsOf(found, current, found.now),
    previous: totalsOf(found, previous, found.before),
    daily: daysUpTo(current.last, length).map((day) => {
      const counts = found.byDay.get(day) ?? NO_COUNTS
      return {
        date: day,
        views: counts.views,
        calls: counts.phoneClicks,
        whatsapp: counts.whatsappClicks,
        messages: found.received.get(day) ?? 0,
      }
    }),
    topListings:
      user.role === "dealership" ? await topListings(scope, current) : [],
  }
}

// Which ids count for the account. `null` means everything (an admin).
async function scopeOf(user: SessionUser) {
  if (user.role === "admin")
    return { admin: true, listingIds: null, businessIds: null, targets: null }
  const [listingIds, businessId] = await Promise.all([
    listings.listIdsOf(db, user.id),
    businesses.getBusinessIdOf(db, user.id),
  ])
  const businessIds = businessId ? [businessId] : []
  return {
    admin: false,
    listingIds,
    businessIds,
    targets: [...listingIds, ...businessIds],
  }
}

type Scope = Awaited<ReturnType<typeof scopeOf>>
type Found = Awaited<ReturnType<typeof load>>

// Everything the cards need, read for both windows at once where one query can cover them.
async function load(input: {
  user: SessionUser
  scope: Scope
  current: DayRange
  previous: DayRange
}) {
  const { user, scope, current, previous } = input
  const both = { first: previous.first, last: current.last }
  const social = (days: DayRange) =>
    Promise.all([
      favorites.countNewFavorites(db, scope.listingIds, days),
      reviews.countNewReviews(db, scope.businessIds, days),
    ])
  const [rows, received, now, before] = await Promise.all([
    scope.targets?.length === 0
      ? []
      : q.listDailyCounts(db, scope.targets, both),
    messaging.countReceivedPerDay(db, scope.admin ? null : user.id, both),
    social(current),
    social(previous),
  ])
  return { byDay: groupByDay(rows), received, now, before }
}

function totalsOf(
  found: Found,
  days: DayRange,
  [newFavorites, newReviews]: number[]
) {
  const sum = sumDays(found.byDay, days)
  let messages = 0
  for (const [day, count] of found.received)
    if (day >= days.first && day <= days.last) messages += count
  return {
    views: sum.views,
    calls: sum.phoneClicks,
    whatsapp: sum.whatsappClicks,
    messages,
    favorites: newFavorites ?? 0,
    newReviews: newReviews ?? 0,
  }
}

// A dealership's listings with the most views in the window, most first.
async function topListings(scope: Scope, days: DayRange) {
  const ids = scope.listingIds ?? []
  if (ids.length === 0) return []
  const rows = await q.listTargetCounts(db, ids, days)
  const counts = ids.map((id) => {
    const sum = sumCounts(rows.filter((row) => row.targetId === id))
    return {
      id,
      views: sum.views,
      contacts: sum.phoneClicks + sum.whatsappClicks,
    }
  })
  // Ties keep id order: the sort is stable.
  const top = counts.sort((a, b) => b.views - a.views).slice(0, TOP_COUNT)
  const cards = await listings.listCards(
    db,
    top.map((item) => item.id)
  )
  return cards.map((card, i) => ({
    ...card,
    views: top[i]?.views ?? 0,
    contacts: top[i]?.contacts ?? 0,
  }))
}
