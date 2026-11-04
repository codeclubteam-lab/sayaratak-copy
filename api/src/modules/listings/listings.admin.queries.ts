import {
  and,
  asc,
  desc,
  eq,
  inArray,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { type SearchScope, verifiedWhere } from "./listings.filters.queries"
import { textIs, typeWhere } from "./listings.mine.queries"
import { listings } from "./listings.tables"

/** The admin table's filters as the mock reads them; empty means not set. */
export type AdminFilters = {
  /** Exactly this state; empty means every state but draft. */
  moderation?: string
  id?: string
  status?: string
  ownerId?: string
  cityId?: string
  type?: string
  /** `individual`, `dealership` or `verified`. */
  sellerKind?: string
  q?: string
  /** The review queue's text search reads the title only; the table also reads the id and the owner's name. */
  titleOnly?: boolean
  /** `yes` or `no` with the ids Featured right now. */
  promoted?: { yes: boolean; featuredIds: string[] }
  verified: SearchScope["verified"]
  page: { offset: number; size: number }
}

/** One page of listings with the total, newest first, ties in id order (the mock's stable sort). */
export async function listForAdmin(ex: Executor, find: AdminFilters) {
  const where = and(
    find.moderation
      ? textIs(listings.moderation, find.moderation)
      : ne(listings.moderation, "draft"),
    find.id ? eq(listings.id, find.id) : undefined,
    textIs(listings.status, find.status),
    find.ownerId ? eq(listings.ownerUserId, find.ownerId) : undefined,
    find.cityId ? eq(listings.cityId, find.cityId) : undefined,
    promotedWhere(find.promoted),
    typeWhere(find.type),
    sellerWhere(find),
    textWhere(find)
  )
  const rows = await ex
    .select({
      listing: listings,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(listings)
    .where(where)
    .orderBy(desc(listings.createdAt), asc(listings.id))
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(listings, where))
  return { rows: rows.map((row) => row.listing), total }
}

/** Ids of the listings, in any state, whose title holds `term` (lower case): the text search of the reports queue. */
export function listIdsTitled(ex: Executor, term: string) {
  return ex
    .select({ id: listings.id })
    .from(listings)
    .where(sql`strpos(lower(${listings.title}), ${term}) > 0`)
    .then((rows) => rows.map((row) => row.id))
}

// A promotion running now: a listing in the Featured list, or not in it.
function promotedWhere(promoted: AdminFilters["promoted"]) {
  if (!promoted) return undefined
  if (promoted.yes) return inArray(listings.id, [...promoted.featuredIds, ""])
  return promoted.featuredIds.length > 0
    ? notInArray(listings.id, promoted.featuredIds)
    : undefined
}

function sellerWhere(find: Pick<AdminFilters, "sellerKind" | "verified">) {
  if (find.sellerKind === "individual") return eq(listings.ownerType, "user")
  if (find.sellerKind === "dealership")
    return eq(listings.ownerType, "dealership")
  if (find.sellerKind === "verified") return verifiedWhere(find.verified)
  return undefined
}

function textWhere(find: Pick<AdminFilters, "q" | "titleOnly">) {
  if (!find.q) return undefined
  const inTitle = sql`strpos(lower(${listings.title}), ${find.q}) > 0`
  if (find.titleOnly) return inTitle
  return or(
    inTitle,
    sql`strpos(lower(${listings.id}), ${find.q}) > 0`,
    // Raw SQL: the owner name is jsonb `{ ar, en }`; either language may match.
    sql`strpos(lower(${listings.ownerName} ->> 'ar'), ${find.q}) > 0`,
    sql`strpos(lower(${listings.ownerName} ->> 'en'), ${find.q}) > 0`
  )
}
