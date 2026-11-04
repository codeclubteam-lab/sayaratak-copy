import { and, asc, count, eq, ilike, inArray, lte, or, sql } from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"
import { type DayRange, dayColumn, withinDays } from "~/shared/time/khartoum"

import { user } from "./auth.tables"

export function countUsers(ex: Executor) {
  return ex.$count(user)
}

/** New accounts per Khartoum day inside `days`; days with none are missing. */
export function listCreatedPerDay(ex: Executor, days: DayRange) {
  const day = dayColumn(user.createdAt)
  return ex
    .select({ day, count: count() })
    .from(user)
    .where(withinDays(user.createdAt, days))
    .groupBy(day)
}

/** Accounts whose name, phone or email holds the pattern, in the mock's id order (`u-1`, `u-2`, `u-10`). */
export function search(ex: Executor, find: { pattern: string; limit: number }) {
  return ex
    .select({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
    })
    .from(user)
    .where(
      or(
        ilike(user.name, find.pattern),
        ilike(user.phone, find.pattern),
        ilike(user.email, find.pattern)
      )
    )
    .orderBy(asc(sql`length(${user.id})`), asc(user.id))
    .limit(find.limit)
}

/** An account lists the city as its own. */
export function hasUserInCity(ex: Executor, cityId: string) {
  return ex
    .select({ id: user.id })
    .from(user)
    .where(eq(user.cityId, cityId))
    .limit(1)
    .then((rows) => rows.length > 0)
}

/**
 * Accounts that read announcements: not an admin, in one of the roles, not banned now (a timed
 * ban that has ended counts as lifted) and with the announcements switch on, in id order.
 * `page` takes the next `size` after `after` among accounts created by `createdBy`: the broadcast
 * job walks the audience this way.
 */
export function listAnnouncementTargets(
  ex: Executor,
  find: {
    roles: (typeof user.$inferSelect)["role"][]
    now: Date
    page?: { after?: string; createdBy: Date; size: number }
  }
) {
  const { page } = find
  const query = ex
    .select({ id: user.id, role: user.role, cityId: user.cityId })
    .from(user)
    .where(
      and(
        inArray(user.role, find.roles),
        sql`${user.role} <> 'admin'`,
        sql`not (${user.banned} and (${user.banExpires} is null or ${user.banExpires} > ${find.now}))`,
        // The switches are a JSON object; a missing key counts as off.
        sql`(${user.prefs} ->> 'announcements') = 'true'`,
        page && lte(user.createdAt, page.createdBy),
        // Same order as below: shorter ids first (`u-9` before `u-10`), then by text.
        page?.after
          ? sql`(length(${user.id}), ${user.id}) > (length(${page.after}), ${page.after})`
          : undefined
      )
    )
    .orderBy(asc(sql`length(${user.id})`), asc(user.id))
  return page ? query.limit(page.size) : query
}
