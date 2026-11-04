import type { Listing } from "@sayaratak/shared/schemas/listing"
import { makeListingSlug } from "@sayaratak/shared/lib/slug"

import { type Transaction, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as content from "~/modules/content/content.service"
import * as uploads from "~/modules/uploads/uploads.media.service"

import * as q from "./listings.queries"
import { checkCanEdit, newFreeListingId } from "./listings.rules.service"
import { toOneListing } from "./listings.view.service"

const DAY_MS = 86_400_000

/** Deletes the listing for good, with its photos; favorites of it go too (owner or admin). */
export function deleteListing(user: SessionUser, id: string) {
  return transaction(async (tx) => {
    await editable(tx, { user, id })
    const media = await q.listMediaIds(tx, [id])
    await q.deleteListing(tx, id)
    await uploads.deleteMediaFiles(
      tx,
      media.map((row) => row.uploadId)
    )
  })
}

/** Marks the listing available, reserved, sold or rented. Never moves its review state. */
export function setListingStatus(
  user: SessionUser,
  change: { id: string; status: Listing["status"] }
) {
  return transaction(async (tx) => {
    await editable(tx, { user, id: change.id })
    const row = await q.updateListing(tx, {
      id: change.id,
      set: { status: change.status, updatedAt: clock.now() },
    })
    return toOneListing(tx, row, user)
  })
}

/** Adds the expiry setting's days to the later of now and the current end, so renewing early loses no days. */
export function renewListing(user: SessionUser, id: string) {
  return transaction(async (tx) => {
    const row = await editable(tx, { user, id })
    const settings = await content.getListingSettings(tx)
    const now = clock.now()
    const from = Math.max(now.getTime(), row.expiresAt.getTime())
    const saved = await q.updateListing(tx, {
      id,
      set: {
        expiresAt: new Date(from + settings.listingExpiryDays * DAY_MS),
        updatedAt: now,
      },
    })
    return toOneListing(tx, saved, user)
  })
}

/**
 * A new draft with everything the listing has, photos included, and none of
 * its history: no promotions, counters at zero, available. The expiry date is
 * copied, as the mock does; renewing or sending it sets a new one.
 */
export function duplicateListing(user: SessionUser, id: string) {
  return transaction(async (tx) => {
    const row = await editable(tx, { user, id })
    const media = await q.listMediaIds(tx, [id])
    const copyId = await newFreeListingId(tx)
    const now = clock.now()
    const copy = await q.insertListing(tx, {
      ...row,
      id: copyId,
      slug: makeListingSlug(row.title, row.cityId, copyId),
      moderation: "draft",
      status: "available",
      rejectionReason: null,
      bumpedAt: null,
      expiredNotifiedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    const ownerUserId = row.ownerUserId ?? user.id
    const uploadIds = await uploads.copyMedia(tx, {
      ids: media.map((m) => m.uploadId),
      ownerUserId,
    })
    await q.replaceMedia(tx, { listingId: copyId, uploadIds })
    return toOneListing(tx, copy, user)
  })
}

// The listing, locked, once the user may change it: 404 when it does not
// exist, 403 `forbidden` for anyone but the owner or an admin.
async function editable(
  tx: Transaction,
  target: { user: SessionUser; id: string }
) {
  // FOR UPDATE: actions on one listing run one after the other.
  const row = await q.lockListing(tx, target.id)
  if (!row) fail.notFound()
  checkCanEdit(target.user, row)
  return row
}
