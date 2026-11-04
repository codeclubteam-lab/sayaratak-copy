import type { listingPatchSchema } from "@sayaratak/shared/schemas/inputs"
import { makeListingSlug } from "@sayaratak/shared/lib/slug"
import type { z } from "zod"

import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { both } from "~/shared/text/bilingual"
import { clock } from "~/shared/time/clock"
import * as auth from "~/modules/auth/auth.service"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as savedSearches from "~/modules/saved-searches/saved-searches.service"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import { columnsOf, searchTextOf } from "./listings.columns.service"
import * as q from "./listings.queries"
import {
  checkCanEdit,
  checkSubmitted,
  checkUnderLimit,
  publishState,
} from "./listings.rules.service"
import type { ListingRow } from "./listings.view.service"

type PatchBody = z.output<typeof listingPatchSchema>
type Change = { user: SessionUser; id: string; body: PatchBody }

const REOPENED = new Set(["draft", "rejected"])

/**
 * Applies a patch inside the caller's transaction and returns the saved row:
 * the listing is locked, the editor checked, the media swapped, the
 * moderation state moved (mock `PATCH /listings/:id`, rule by rule).
 */
export async function saveChanges(tx: Transaction, change: Change) {
  const { user, body } = change
  // FOR UPDATE: two saves of one listing apply one after the other.
  const row = await q.lockListing(tx, change.id)
  if (!row) fail.notFound()
  checkCanEdit(user, row)
  const { submit, moderation, ...patch } = body
  if (moderation && user.role !== "admin") fail.forbidden()
  // The wizard sends the whole listing (it always has `kind`); a partial patch such as a status change is not re-checked.
  if (submit && patch.kind !== undefined) checkSubmitted(body)
  const media = await swapMedia(tx, { row, media: patch.media })
  const next = await nextColumns(tx, { row, patch })
  const changed = reviewed(row, media.before) !== reviewed(next, media.after)
  next.moderation =
    moderation ?? (await movedModeration(tx, { user, row, changed }))
  if (submit && REOPENED.has(row.moderation)) {
    await checkOwnerLimit(tx, row)
    next.moderation = await publishState(tx, user, true)
    next.rejectionReason = null
  }
  const saved = await q.updateListing(tx, { id: row.id, set: next })
  if (saved.moderation === "approved" && row.moderation !== "approved")
    await savedSearches.onListingApproved(tx, saved)
  return saved
}

async function nextColumns(
  tx: Transaction,
  change: { row: ListingRow; patch: Omit<PatchBody, "submit" | "moderation"> }
) {
  const { row, patch } = change
  const merged = { ...row, ...columnsOf(patch, row.details) }
  if (patch.description !== undefined)
    merged.description = both(patch.description)
  if (patch.contact) merged.contact = { ...row.contact, ...patch.contact }
  await taxonomy.checkPicks(tx, merged)
  // The slug follows the title and city, and always ends in the id.
  if (patch.title !== undefined || patch.cityId !== undefined)
    merged.slug = makeListingSlug(merged.title, merged.cityId, row.id)
  merged.searchText = await searchTextOf(tx, merged)
  merged.updatedAt = clock.now()
  const { id: _id, createdAt: _createdAt, ...set } = merged
  return set
}

// Handoff "Moderation": changing what a buyer judges the listing by (title,
// description, photos, kind, type, part category) sends an approved one back
// to review, unless the owner is auto-approved. Price and status never do.
async function movedModeration(
  tx: Transaction,
  change: { user: SessionUser; row: ListingRow; changed: boolean }
) {
  const { user, row } = change
  if (row.moderation !== "approved" || user.role === "admin" || !change.changed)
    return row.moderation
  return publishState(tx, user, true)
}

/** The media ids before and after; with a `media` list the new files are attached and the dropped ones deleted. */
async function swapMedia(
  tx: Transaction,
  change: { row: ListingRow; media: PatchBody["media"] }
) {
  const { row } = change
  const before = (await q.listMediaIds(tx, [row.id])).map(
    (media) => media.uploadId
  )
  if (change.media === undefined) return { before, after: before }
  const after = change.media.map((media) => media.id)
  if (sameIds(before, after)) return { before, after }
  // An admin edits on the owner's behalf, so the files must be the owner's.
  await uploads.attachMedia(tx, {
    ownerUserId: row.ownerUserId ?? "",
    ids: after,
    kept: before,
  })
  await q.replaceMedia(tx, { listingId: row.id, uploadIds: after })
  await uploads.deleteMediaFiles(
    tx,
    before.filter((id) => !after.includes(id))
  )
  return { before, after }
}

async function checkOwnerLimit(tx: Transaction, row: ListingRow) {
  if (!row.ownerUserId) return
  const [owner] = await auth.listUsers(tx, [row.ownerUserId])
  if (owner) await checkUnderLimit(tx, owner)
}

function reviewed(
  listing: Pick<
    ListingRow,
    "title" | "description" | "kind" | "vehicleType" | "partCategoryId"
  >,
  mediaIds: string[]
) {
  return JSON.stringify([
    listing.title,
    listing.description,
    mediaIds,
    listing.kind,
    listing.vehicleType,
    listing.partCategoryId,
  ])
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i])
}
