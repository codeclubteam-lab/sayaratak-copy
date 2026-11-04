import type { SearchParams } from "@sayaratak/shared/search/schemas"

import { db } from "~/shared/db/client"
import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import { listingMatchesSearch } from "~/modules/listings/listings.search.service"
import { notify } from "~/modules/notifications/notifications.service"

import { toSavedSearch } from "./saved-searches.mapper"
import * as q from "./saved-searches.queries"

const ID_PREFIX = "ss"
const MATCH_TITLE = {
  ar: "إعلان جديد يطابق بحثك",
  en: "A new listing matches your search",
}

/** `GET /saved-searches`: the user's searches, oldest first. */
export async function listSavedSearches(user: SessionUser) {
  return (await q.listOf(db, user.id)).map(toSavedSearch)
}

/** `POST /saved-searches`: a new search starts with no new matches. */
export async function createSavedSearch(
  user: SessionUser,
  input: { name: string; params: SearchParams; alerts: boolean }
) {
  const saved = await q.insert(db, {
    id: newId(ID_PREFIX),
    userId: user.id,
    ...input,
    newCount: 0,
    createdAt: clock.now(),
  })
  if (!saved) throw new Error("the insert returned no row")
  return toSavedSearch(saved)
}

/** `PATCH /saved-searches/:id`: the fields sent; `markSeen` zeroes the new-match count. 404 for one the user does not have. */
export async function editSavedSearch(
  user: SessionUser,
  edit: {
    id: string
    change: { name?: string; alerts?: boolean; markSeen?: boolean }
  }
) {
  const row = await q.getOf(db, { id: edit.id, userId: user.id })
  if (!row) fail.notFound()
  const { name, alerts, markSeen } = edit.change
  const newCount = markSeen ? 0 : undefined
  if (name === undefined && alerts === undefined && newCount === undefined)
    return toSavedSearch(row)
  const saved = await q.update(db, row.id, { name, alerts, newCount })
  return toSavedSearch(saved ?? row)
}

/** `DELETE /saved-searches/:id`: 404 for one the user does not have. */
export async function deleteSavedSearch(user: SessionUser, id: string) {
  const row = await q.getOf(db, { id, userId: user.id })
  if (!row) fail.notFound()
  await q.remove(db, row.id)
}

/**
 * A listing just became public: each saved search with alerts on, of anyone
 * but the owner, that the listing matches gets one more new match. Every
 * path that approves a listing calls this in its transaction (create with
 * auto-approve, submit, patch, and the admin approve and restore of 8.3).
 * Each of those people is told in the bell too (unless they switched it off).
 */
// ponytail: one match query per alerting search; group equal params or match in SQL when searches reach the thousands.
export async function onListingApproved(
  tx: Transaction,
  listing: {
    id: string
    slug: string
    title: string
    ownerUserId: string | null
  }
) {
  const alerting = await q.listAlertingExcept(tx, listing.ownerUserId)
  const matched: typeof alerting = []
  for (const search of alerting)
    if (
      await listingMatchesSearch(tx, {
        id: listing.id,
        params: search.params,
      })
    )
      matched.push(search)
  await q.bumpNewCount(
    tx,
    matched.map((search) => search.id)
  )
  for (const search of matched)
    await notify(tx, {
      userId: search.userId,
      type: "saved_search_match",
      title: MATCH_TITLE,
      body: { ar: listing.title, en: listing.title },
      href: `/listing/${listing.slug}`,
    })
}
