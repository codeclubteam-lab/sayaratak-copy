import type { Executor } from "~/shared/db/tx"
import { containing } from "~/shared/text/like"
import { clock } from "~/shared/time/clock"
import type { DayRange } from "~/shared/time/khartoum"

import * as q from "./auth.overview.queries"

/** How many accounts exist, of any role. */
export function countUsers(ex: Executor) {
  return q.countUsers(ex)
}

/** New accounts per Khartoum day, as a day to count map. */
export async function countUsersPerDay(ex: Executor, days: DayRange) {
  const rows = await q.listCreatedPerDay(ex, days)
  return new Map(rows.map((row) => [row.day, row.count]))
}

/** Up to `limit` accounts whose name, phone or email holds `term`, for the admin search. */
export function searchUsers(
  ex: Executor,
  find: { term: string; limit: number }
) {
  return q.search(ex, { pattern: containing(find.term), limit: find.limit })
}

/** An account lists this city as its own: the check before an admin deletes it. */
export function hasUserInCity(ex: Executor, cityId: string) {
  return q.hasUserInCity(ex, cityId)
}

/**
 * The accounts an announcement may reach in these roles: the admin is never one, nor an account
 * banned now, nor one that switched announcements off. Each with its own city. `page` takes one
 * chunk of them, in id order, among the accounts created by `createdBy`.
 */
export function listAnnouncementTargets(
  ex: Executor,
  roles: Parameters<typeof q.listAnnouncementTargets>[1]["roles"],
  page?: { after?: string; createdBy: Date; size: number }
) {
  return q.listAnnouncementTargets(ex, { roles, now: clock.now(), page })
}
