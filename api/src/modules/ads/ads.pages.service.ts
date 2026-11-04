import type { AdPageId } from "@sayaratak/shared/schemas/ads"

import { db } from "~/shared/db/client"
import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"

import { toAdPage } from "./ads.mapper"
import * as q from "./ads.queries"
import * as campaignsQ from "./ads.campaigns.queries"

const DAY_MS = 86_400_000
const DAYS_PER_WEEK = 7
const WEEKS_MAX = 4
const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/

export type DateRange = { startsAt: Date; endsAt: Date }

/**
 * The dates of a campaign: whole weeks from the start day (UTC midnight, as
 * the mock). Undefined for a start that is not a real day.
 * `rangeOf("2026-11-02", 2)` runs 2026-11-02 to 2026-11-16.
 */
export function rangeOf(startDate: string, weeks: number) {
  if (!DAY_FORMAT.test(startDate)) return undefined
  const startsAt = new Date(`${startDate}T00:00:00.000Z`)
  if (Number.isNaN(startsAt.getTime())) return undefined
  const endsAt = new Date(startsAt.getTime() + weeks * DAYS_PER_WEEK * DAY_MS)
  return { startsAt, endsAt }
}

/**
 * `GET /ad-pages`: the pages on sale with their price, slots and how many
 * slots are free. With a start day and 1 to 4 weeks, free counts that period;
 * without, it is every slot.
 */
export async function listAdPages(ask: { startDate?: string; weeks?: string }) {
  const weeks = Number(ask.weeks ?? 0)
  const range =
    ask.startDate && weeks >= 1 && weeks <= WEEKS_MAX
      ? rangeOf(ask.startDate, weeks)
      : undefined
  const [pages, holds] = await Promise.all([
    q.listPages(db),
    range ? campaignsQ.listHoldingPages(db, range) : [],
  ])
  return pages
    .filter((page) => page.enabled)
    .map((page) => toAdPage(page, freeSlots(page, holds)))
}

/**
 * Holds every chosen page until the transaction ends and checks that each
 * still has a free slot for these dates; 409 `page_full` otherwise. Returns
 * the held pages, so a price is read from the rows that were checked.
 * A campaign being rechecked passes its own id, so it does not count itself.
 */
export async function lockRoom(
  tx: Transaction,
  find: DateRange & { pages: AdPageId[]; except?: string }
) {
  const locked = await q.lockPages(tx, find.pages)
  const holds = await campaignsQ.listHoldingPages(tx, find)
  const full = find.pages.some((id) => {
    const page = locked.find((row) => row.id === id)
    return !page || freeSlots(page, holds) < 1
  })
  if (full) fail.conflict("page_full")
  return locked
}

// Slots left on a page: its slots less the campaigns that hold it in the period.
function freeSlots(page: { id: AdPageId; slots: number }, holds: AdPageId[][]) {
  const taken = holds.filter((pages) => pages.includes(page.id)).length
  return Math.max(0, page.slots - taken)
}
