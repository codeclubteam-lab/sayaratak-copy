import type { EventType } from "@sayaratak/shared/schemas/api"

import { fail } from "~/shared/http/errors"
import type { Executor } from "~/shared/db/tx"
import type { SessionUser } from "~/modules/auth/auth.types"

import * as q from "./listings.queries"
import * as statsQ from "./listings.stats.queries"
import { checkCanEdit } from "./listings.rules.service"
import { listByIds } from "./listings.search.queries"
import { toListings } from "./listings.view.service"

const COUNTERS = {
  view: "views",
  phone_click: "phoneClicks",
  whatsapp_click: "whatsappClicks",
} as const

/**
 * Raises the listing's own counter for a view or a click. A share only
 * checks that the listing exists. False when there is no such listing.
 */
export async function countListingEvent(
  ex: Executor,
  event: { id: string; type: EventType }
) {
  const counter = COUNTERS[event.type as keyof typeof COUNTERS]
  if (counter) return q.bumpStat(ex, event.id, counter)
  return q.hasListing(ex, event.id)
}

/** Whether a listing with this id exists, in any state. */
export function hasListing(ex: Executor, id: string) {
  return q.hasListing(ex, id)
}

/** A listing was saved (`1`) or unsaved (`-1`) by this many people more: the saved-by counter follows. */
export function moveFavorites(ex: Executor, ids: string[], delta: 1 | -1) {
  return statsQ.bumpFavorites(ex, ids, delta)
}

/** Ids of every listing the user owns, in id order, whatever their state. */
export function listIdsOf(ex: Executor, ownerUserId: string) {
  return q.listIdsOf(ex, ownerUserId)
}

/**
 * The saved-by count of a listing the user may edit (owner or admin).
 * 404 `not_found`, 403 `forbidden`.
 */
export async function getFavoritesOfEditable(
  ex: Executor,
  target: { user: SessionUser; id: string }
) {
  const row = await q.getListing(ex, target.id)
  if (!row) fail.notFound()
  checkCanEdit(target.user, row)
  const [stats] = await q.listStats(ex, [target.id])
  return stats?.favorites ?? 0
}

/** The listings' id, slug, title and cover picture (a video gives its poster), in the order of `ids`. */
export async function listCards(ex: Executor, ids: string[]) {
  const rows = await listByIds(ex, ids)
  const found = await toListings(ex, rows, null)
  return found.map((listing) => {
    const cover = listing.media[0]
    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      coverUrl:
        (cover?.type === "video" ? cover.posterUrl : cover?.url) ?? null,
    }
  })
}
