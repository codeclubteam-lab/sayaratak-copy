import type { WeeklyHours } from "@sayaratak/shared/schemas/fields"

const KHARTOUM_OFFSET_MS = 2 * 3_600_000

// Sudan's week starts on Saturday. `day` is 0 for Sunday, as in `isOpenNow`.
export const SAT_FIRST = [6, 0, 1, 2, 3, 4, 5]

// The weekday (0 = Sunday) on the Khartoum clock, to mark today in an hours table.
export const khartoumDay = (now: number) =>
  new Date(now + KHARTOUM_OFFSET_MS).getUTCDay()

// Open now from weekly hours, on the Khartoum clock (UTC+2, no daylight saving). `now` is passed in so SSR and hydration agree.
export function isOpenNow(hours: WeeklyHours, now: number) {
  const t = new Date(now + KHARTOUM_OFFSET_MS)
  const today = hours.find((h) => h.day === t.getUTCDay())
  const hm = `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`
  return Boolean(today && !today.closed && today.open <= hm && hm < today.close)
}

// Onboarding starts a business on Saturday to Thursday, 8:00 to 18:00, Friday closed (day 5).
export const defaultWeeklyHours: WeeklyHours = Array.from(
  { length: 7 },
  (_, day) => ({ day, closed: day === 5, open: "08:00", close: "18:00" })
)
