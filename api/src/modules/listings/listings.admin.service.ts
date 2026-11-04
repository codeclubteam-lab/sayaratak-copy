import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.service"
import * as promotions from "~/modules/promotions/promotions.service"

import * as q from "./listings.admin.queries"
import { getListing } from "./listings.queries"
import { toListings } from "./listings.view.service"

const PAGE_SIZE = { default: 20, max: 100 }
const NO_IDS: string[] = []

/** Raw query values of `GET /admin/listings` and `/admin/moderation`, read as the mock reads them. */
export type AdminQuery = Partial<
  Record<
    | "moderation"
    | "id"
    | "status"
    | "ownerId"
    | "cityId"
    | "promoted"
    | "type"
    | "sellerKind"
    | "q"
    | "page"
    | "pageSize"
    | "limit",
    string
  >
>

/**
 * `GET /admin/listings`: every listing but drafts (a seller's unpublished
 * work) unless `moderation` asks for them, newest first.
 * Example: `?moderation=rejected&sellerKind=dealership&promoted=no`.
 */
export function listAdminListings(admin: SessionUser, query: AdminQuery) {
  return readPage(admin, query)
}

/** `GET /admin/moderation`: the pending listings, newest first. */
export function listModerationQueue(admin: SessionUser, query: AdminQuery) {
  return readPage(
    admin,
    {
      type: query.type,
      sellerKind: query.sellerKind,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
      limit: query.limit,
      moderation: "pending",
    },
    true
  )
}

async function readPage(
  admin: SessionUser,
  query: AdminQuery,
  titleOnly = false
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const { featuredIds, verified } = await scopeOf(query)
  const found = await q.listForAdmin(db, {
    moderation: query.moderation,
    id: query.id,
    status: query.status,
    ownerId: query.ownerId,
    cityId: query.cityId,
    type: query.type,
    sellerKind: query.sellerKind,
    q: query.q?.trim().toLowerCase() || undefined,
    titleOnly,
    promoted: query.promoted
      ? { yes: query.promoted === "yes", featuredIds }
      : undefined,
    verified,
    page: { offset: (page - 1) * size, size },
  })
  return {
    items: await toListings(db, found.rows, admin),
    total: found.total,
    page,
    pageSize: size,
  }
}

// The id lists a filter needs from other modules; each is read only when asked.
async function scopeOf(query: AdminQuery) {
  const [featuredIds, userIds, dealershipOwnerIds] = await Promise.all([
    query.promoted ? promotions.listFeaturedIds(db) : NO_IDS,
    query.sellerKind === "verified" ? auth.listPhoneVerifiedIds(db) : NO_IDS,
    query.sellerKind === "verified"
      ? businesses.listVerifiedDealershipOwnerIds(db)
      : NO_IDS,
  ])
  return { featuredIds, verified: { userIds, dealershipOwnerIds } }
}

/** Ids of the listings, in any state, whose title holds `term` (lower case). */
export function listIdsTitled(ex: Executor, term: string) {
  return q.listIdsTitled(ex, term)
}

/** One listing of any state for the admin, or 404. */
export async function getForAdmin(ex: Executor, id: string) {
  const row = await getListing(ex, id)
  if (!row) fail.notFound()
  return row
}
