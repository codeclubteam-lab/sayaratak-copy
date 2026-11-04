import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"

// Sudan is UTC+2 all year, with no daylight saving (A1 rule 7 names the zone).
const KHARTOUM_OFFSET_MS = 2 * 3_600_000
const FRIDAY = 5
const DAYS_IN_WEEK = 7

/** What a new business starts with: Saturday to Thursday 8:00 to 18:00, Friday closed. */
export const DEFAULT_HOURS: WeeklyHours = Array.from(
  { length: DAYS_IN_WEEK },
  (_, day) => ({ day, closed: day === FRIDAY, open: "08:00", close: "18:00" })
)

/**
 * Whether weekly hours say open at this instant, on the Khartoum clock.
 * `day` is 0 for Sunday. Example: Sunday 09:30 Khartoum is open under
 * `{ day: 0, open: "08:00", close: "18:00" }`; 18:00 sharp is closed.
 */
export function isOpenNow(hours: WeeklyHours, now: Date) {
  const local = new Date(now.getTime() + KHARTOUM_OFFSET_MS)
  const today = hours.find((row) => row.day === local.getUTCDay())
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  return Boolean(
    today && !today.closed && today.open <= time && time < today.close
  )
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}
