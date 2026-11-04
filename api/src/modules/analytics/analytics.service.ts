import type {
  EventType,
  ListingAnalytics,
  Range,
} from "@sayaratak/shared/schemas/api"
import type { eventInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { type Transaction, transaction } from "~/shared/db/tx"
import { clock } from "~/shared/time/clock"
import { dayOf, daysBefore, daysUpTo } from "~/shared/time/khartoum"
import * as ads from "~/modules/ads/ads.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as listings from "~/modules/listings/listings.stats.service"

import { groupByDay, NO_COUNTS, sumDays } from "./analytics.mapper"
import * as q from "./analytics.queries"

type EventInput = z.output<typeof eventInputSchema>

const LENGTHS = { "7d": 7, "30d": 30, "90d": 90 } as const

/**
 * The current window of whole Khartoum days (today and the days before it)
 * and the window of the same length just before it, for the change on each
 * stat card. Example: `30d` on 2026-11-01 is 2026-10-03 to 2026-11-01, and
 * the previous one 2026-09-03 to 2026-10-02.
 */
export function windowsOf(range: Range) {
  const length = LENGTHS[range]
  const today = dayOf(clock.now())
  return {
    length,
    current: { first: daysBefore(today, length - 1), last: today },
    previous: {
      first: daysBefore(today, 2 * length - 1),
      last: daysBefore(today, length),
    },
  }
}

/**
 * Counts one view or click on a listing, business, banner or campaign, in the
 * target's own counter and in the day's event row. An id that names none of
 * them is ignored, so a stranger cannot grow the table with made-up ids.
 */
export async function recordEvent(event: EventInput) {
  await transaction(async (tx) => {
    if (!(await countOnTarget(tx, event))) return
    await q.bumpEvent(tx, {
      day: dayOf(clock.now()),
      targetId: event.targetId,
      type: event.type,
    })
  })
}

/** Deletes the view and click counters of a business that is going away. */
export async function deleteEventsOf(tx: Transaction, targetId: string) {
  await q.deleteOfTarget(tx, targetId)
}

/** One listing's counters per day and in total, for its owner or an admin. */
export async function getListingAnalytics(
  user: SessionUser,
  target: { id: string; range: Range }
): Promise<ListingAnalytics> {
  const favorites = await listings.getFavoritesOfEditable(db, {
    user,
    id: target.id,
  })
  const { length, current } = windowsOf(target.range)
  const byDay = groupByDay(await q.listDailyCounts(db, [target.id], current))
  const total = sumDays(byDay, current)
  return {
    range: target.range,
    totals: {
      views: total.views,
      phoneClicks: total.phoneClicks,
      whatsappClicks: total.whatsappClicks,
      shares: total.shares,
      favorites,
    },
    series: daysUpTo(current.last, length).map((day) => {
      const counts = byDay.get(day) ?? NO_COUNTS
      return {
        day,
        views: counts.views,
        phoneClicks: counts.phoneClicks,
        whatsappClicks: counts.whatsappClicks,
      }
    }),
    top: [],
  }
}

async function countOnTarget(tx: Transaction, event: EventInput) {
  const { type, targetId } = event
  if (isAdEvent(type))
    return ads.countAdEvent(tx, {
      targetId,
      counter: type === "banner_click" ? "clicks" : "impressions",
    })
  return (
    (await listings.countListingEvent(tx, { id: targetId, type })) ||
    businesses.hasBusiness(tx, targetId)
  )
}

function isAdEvent(type: EventType) {
  return type === "banner_click" || type === "banner_view"
}
