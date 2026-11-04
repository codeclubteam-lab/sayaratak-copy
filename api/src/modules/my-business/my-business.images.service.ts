import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as businesses from "~/modules/businesses/businesses.images.service"
import * as refs from "~/modules/businesses/businesses.update.service"
import * as plans from "~/modules/plans/plans.service"
import * as uploads from "~/modules/uploads/uploads.service"

import { profileOf } from "./my-business.service"

// One workshop shows at most this many photos (the mock's rule; a plan's `photoLimit` can lower it).
const PHOTOS_MAX = 20

/** `POST /me/business/images`: adds one of the workshop's own uploaded photos, by address, at the end. */
export async function addMyImage(user: SessionUser, url: string) {
  return transaction(async (tx) => {
    const workshopId = await lockWorkshop(tx, user.id)
    const id = await uploads.getOwnImageId(tx, { ownerUserId: user.id, url })
    if (!id) fail.validation({ url: "validation.url" })
    const before = await businesses.getWorkshopImageIds(tx, workshopId)
    const ids = before.includes(id) ? before : [...before, id]
    await save(tx, { user, workshopId, ids, before })
    return profileOf(tx, {
      ref: { kind: "workshop", id: workshopId },
      ownerUserId: user.id,
    })
  })
}

/**
 * `PUT /me/business/images`: the photos become `ids` in that order. New ones
 * are the owner's own unused images, left-out ones are deleted. Past the
 * plan's photo limit only fewer or equal photos are allowed, so a downgraded
 * workshop keeps what it has and can reorder or remove.
 */
export async function saveMyImages(user: SessionUser, ids: string[]) {
  return transaction(async (tx) => {
    const workshopId = await lockWorkshop(tx, user.id)
    const unique = [...new Set(ids)]
    const before = await businesses.getWorkshopImageIds(tx, workshopId)
    await save(tx, { user, workshopId, ids: unique, before })
    return profileOf(tx, {
      ref: { kind: "workshop", id: workshopId },
      ownerUserId: user.id,
    })
  })
}

async function lockWorkshop(
  tx: Parameters<Parameters<typeof transaction>[0]>[0],
  userId: string
) {
  const ref = await refs.getBusinessRefOf(tx, userId)
  if (ref?.kind !== "workshop") fail.notFound()
  await refs.lockBusiness(tx, ref)
  return ref.id
}

async function save(
  tx: Parameters<Parameters<typeof transaction>[0]>[0],
  edit: {
    user: SessionUser
    workshopId: string
    ids: string[]
    before: string[]
  }
) {
  if (edit.ids.length > PHOTOS_MAX)
    fail.validation({ ids: "validation.media_max" })
  const cap = (await plans.getActivePlan(tx, edit.user.id))?.photoLimit
  if (
    cap != null &&
    edit.ids.length > cap &&
    edit.ids.length > edit.before.length
  )
    fail.limit("limit_reached")
  await businesses.replaceWorkshopImages(tx, {
    workshopId: edit.workshopId,
    ownerUserId: edit.user.id,
    ids: edit.ids,
    field: "ids",
  })
}
