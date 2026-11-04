import type { EventType } from "@sayaratak/shared/schemas/api"

export type Counts = {
  views: number
  phoneClicks: number
  whatsappClicks: number
  shares: number
}

export const NO_COUNTS: Counts = {
  views: 0,
  phoneClicks: 0,
  whatsappClicks: 0,
  shares: 0,
}

const KEYS: Partial<Record<EventType, keyof Counts>> = {
  view: "views",
  phone_click: "phoneClicks",
  whatsapp_click: "whatsappClicks",
  share: "shares",
}

/** Adds the rows' counts into one `Counts`. Banner types are not page counters and add nothing. */
export function sumCounts(rows: { type: EventType; count: number }[]) {
  const total = { ...NO_COUNTS }
  for (const row of rows) {
    const key = KEYS[row.type]
    if (key) total[key] += row.count
  }
  return total
}

/** Page counters grouped by day. */
export function groupByDay(
  rows: { day: string; type: EventType; count: number }[]
) {
  const days = new Map<string, Counts>()
  for (const row of rows) {
    const key = KEYS[row.type]
    if (!key) continue
    const counts = days.get(row.day) ?? { ...NO_COUNTS }
    counts[key] += row.count
    days.set(row.day, counts)
  }
  return days
}

/** Adds up the days from `first` to `last` of a per-day map. */
export function sumDays(
  byDay: Map<string, Counts>,
  days: { first: string; last: string }
) {
  const total = { ...NO_COUNTS }
  for (const [day, counts] of byDay) {
    if (day < days.first || day > days.last) continue
    total.views += counts.views
    total.phoneClicks += counts.phoneClicks
    total.whatsappClicks += counts.whatsappClicks
    total.shares += counts.shares
  }
  return total
}
