import {
  and,
  asc,
  type Column,
  desc,
  eq,
  gt,
  inArray,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { listings, listingStats } from "./listings.tables"

const DAY_MS = 86_400_000

/** The owner's table filters, as the mock reads them; empty means not set. */
export type MineFilters = {
  ownerUserId: string
  now: Date
  tab: string
  q?: string
  type?: string
  intent?: string
  moderation?: string
  status?: string
  needsAttention: boolean
  sort?: string
  dir: "asc" | "desc"
  page: { offset: number; size: number }
}

/** One page of the owner's listings with the total. Ties keep id order (the mock's stable sort). */
export async function listMine(ex: Executor, find: MineFilters) {
  const where = and(
    eq(listings.ownerUserId, find.ownerUserId),
    tabWhere(find.tab, find.now),
    find.q
      ? or(
          sql`strpos(lower(${listings.title}), ${find.q}) > 0`,
          sql`strpos(lower(${listings.id}), ${find.q}) > 0`
        )
      : undefined,
    typeWhere(find.type),
    textIs(listings.intent, find.intent),
    textIs(listings.moderation, find.moderation),
    textIs(listings.status, find.status),
    find.needsAttention ? attentionWhere(find.now) : undefined
  )
  const key = sortKey(find.sort)
  const rows = await ex
    .select({
      listing: listings,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(listings)
    .leftJoin(listingStats, eq(listingStats.listingId, listings.id))
    .where(where)
    .orderBy(find.dir === "asc" ? asc(key) : desc(key), asc(listings.id))
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(listings, where))
  return { rows: rows.map((row) => row.listing), total }
}

// Tab rules (web 8.2): active is approved, available or reserved and not
// expired; pending, rejected and drafts follow moderation. Any other tab is
// everything but removed.
function tabWhere(tab: string, now: Date) {
  const tabs: Record<string, SQL | undefined> = {
    active: and(
      eq(listings.moderation, "approved"),
      inArray(listings.status, ["available", "reserved"]),
      gt(listings.expiresAt, now)
    ),
    pending: eq(listings.moderation, "pending"),
    rejected: eq(listings.moderation, "rejected"),
    drafts: eq(listings.moderation, "draft"),
    closed: inArray(listings.status, ["sold", "rented"]),
    expired: and(
      eq(listings.moderation, "approved"),
      lte(listings.expiresAt, now)
    ),
  }
  return tabs[tab] ?? ne(listings.moderation, "removed")
}

export function typeWhere(type: string | undefined) {
  if (!type) return undefined
  if (type === "part") return eq(listings.kind, "part")
  return textIs(listings.vehicleType, type)
}

// Compared as text: a value outside the enum matches nothing instead of failing the cast.
export function textIs(column: Column, value: string | undefined) {
  return value ? sql`${column}::text = ${value}` : undefined
}

// Needs attention: rejected, or approved and either expiring within 7 days or
// reserved without a change for 14 days.
function attentionWhere(now: Date) {
  return or(
    eq(listings.moderation, "rejected"),
    and(
      eq(listings.moderation, "approved"),
      or(
        lt(listings.expiresAt, new Date(now.getTime() + 7 * DAY_MS)),
        and(
          eq(listings.status, "reserved"),
          lte(listings.updatedAt, new Date(now.getTime() - 14 * DAY_MS))
        )
      )
    )
  )
}

// Sort keys of the owner's table; anything else is the posting date.
function sortKey(sort: string | undefined) {
  if (sort === "price") return listings.price
  if (sort === "views") return sql`coalesce(${listingStats.views}, 0)`
  if (sort === "expires") return listings.expiresAt
  return listings.createdAt
}
