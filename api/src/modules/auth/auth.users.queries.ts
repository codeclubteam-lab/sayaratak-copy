import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { account, user } from "./auth.tables"

/** The admin users table's filters as the mock reads them; empty means not set. */
export type UserFilters = {
  id?: string
  role?: string
  /** `banned` is banned now (a permanent ban, or a timed one not over); `active` is everyone else. */
  status?: "active" | "banned"
  q?: string
  now: Date
  page: { offset: number; size: number }
}

/** One page of accounts with the total, newest first. */
export async function listForAdmin(ex: Executor, find: UserFilters) {
  const where = and(
    find.id ? eq(user.id, find.id) : undefined,
    // Compared as text: a role outside the enum matches nothing instead of failing the cast.
    find.role ? sql`${user.role}::text = ${find.role}` : undefined,
    statusWhere(find.status, find.now),
    find.q
      ? sql`strpos(lower(${user.name} || ' ' || coalesce(${user.phone}, '') || ' ' || ${user.email}), ${find.q}) > 0`
      : undefined
  )
  const rows = await ex
    .select({
      user,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt), asc(sql`length(${user.id})`), asc(user.id))
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(user, where))
  return { rows: rows.map((row) => row.user), total }
}

/** Ids of these accounts that can sign in with a password (the rest use Google or Facebook only). */
export function listPasswordHolderIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .selectDistinct({ id: account.userId })
    .from(account)
    .where(and(inArray(account.userId, ids), isNotNull(account.password)))
    .then((rows) => rows.map((row) => row.id))
}

function statusWhere(status: UserFilters["status"], now: Date) {
  const bannedNow = and(
    eq(user.banned, true),
    or(isNull(user.banExpires), gt(user.banExpires, now))
  )
  if (status === "banned") return bannedNow
  if (status === "active") return sql`not coalesce(${bannedNow}, false)`
  return undefined
}
