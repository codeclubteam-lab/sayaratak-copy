import { faker } from "@faker-js/faker"

import { dashboardPath, messagesPath } from "@/lib/navigation"
import type { NotificationPrefs } from "@sayaratak/shared/schemas/api"
import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import type { User } from "@sayaratak/shared/schemas/user"

import { nameEn } from "./words"

// Every switch on, for new accounts and the seeded people.
export const defaultPrefs: NotificationPrefs = {
  messages: true,
  updates: true,
  savedSearchMatches: true,
  reviews: true,
  billing: true,
  announcements: true,
}
// Notifications carry a path with no language. The mock writes dashboard pages without the role's base ("/billing") and the two that differ by role ("/messages", "/listings"); this turns them into the recipient's real path. Public paths pass through.
const underBase = [
  "/billing",
  "/reviews",
  "/verification",
  "/saved-searches",
  "/notifications",
]
export function notificationHref(role: User["role"], href: string) {
  const [path = "", query] = href.split("?")
  const to =
    path === "/messages"
      ? messagesPath(role)
      : path === "/listings"
        ? role === "dealership"
          ? "/dealer/inventory"
          : "/account/listings"
        : underBase.includes(path)
          ? dashboardPath(role) + path
          : path
  return query ? `${to}?${query}` : to
}

export const HOUR = 3_600_000
export const DAY = 24 * HOUR
// Every timestamp is relative to the moment the seed runs, so "posted 3 hours ago" stays believable.
export const clock = { now: 0 }
export const ago = (ms: number) => new Date(clock.now - ms).toISOString()
export const ahead = (ms: number) => new Date(clock.now + ms).toISOString()
export const pick = <T>(items: readonly T[]): T =>
  faker.helpers.arrayElement(items)
export const int = (min: number, max: number) => faker.number.int({ min, max })
export const chance = (p: number) => faker.datatype.boolean({ probability: p })
export const pad = (n: number, width = 2) => String(n).padStart(width, "0")
export const roundTo = (n: number, step: number) => Math.round(n / step) * step
export { slugify } from "@sayaratak/shared/lib/slug"
export const jitter = (n: number, spread = 0.04) =>
  n + (faker.number.float() - 0.5) * spread * 2

// Rating of a business from its reviews (hidden ones already left out): average to one decimal, count, and the count per star.
export const ratingFrom = (stars: number[]) => ({
  count: stars.length,
  avg: stars.length
    ? Math.round((stars.reduce((s, r) => s + r, 0) / stars.length) * 10) / 10
    : 0,
  distribution: [1, 2, 3, 4, 5].map((n) => stars.filter((r) => r === n).length),
})

// Stand-in for machine translation: the real backend translates when the owner saves; the mock stores the typed text in both slots.
export const both = (text: string): Bilingual => ({ ar: text, en: text })
// A person's name in both spellings, from the seed word list; Latin names pass through unchanged.
export const bilingualName = (fullName: string): Bilingual => ({
  ar: fullName,
  en: fullName
    .split(" ")
    .map((w) => nameEn[w] ?? w)
    .join(" "),
})
// The pair lists hold [ar, en] sentences; n of them become one text per language.
export const joinPairs = (pairs: [string, string][], n: number): Bilingual => {
  const used = pairs.slice(0, n)
  return {
    ar: used.map((p) => p[0]).join(" "),
    en: used.map((p) => p[1]).join(" "),
  }
}
