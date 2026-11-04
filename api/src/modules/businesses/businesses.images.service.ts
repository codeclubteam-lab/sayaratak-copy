import type { Transaction } from "~/shared/db/tx"
import * as uploads from "~/modules/uploads/uploads.media.service"

import * as read from "./businesses.profile.queries"
import * as w from "./businesses.write.queries"

/** The upload ids of a workshop's photos, in the owner's order. */
export async function getWorkshopImageIds(tx: Transaction, workshopId: string) {
  const rows = await read.listWorkshopImages(tx, [workshopId])
  return rows.map((row) => row.uploadId)
}

/**
 * Sets a workshop's photos to exactly `ids`, in that order. A photo not shown
 * yet must be the owner's own unused image (422 on `field`); a photo left out
 * is deleted with its file. Example: `[b, a]` over `[a, c]` attaches `b`,
 * keeps `a` and deletes `c`.
 */
export async function replaceWorkshopImages(
  tx: Transaction,
  edit: {
    workshopId: string
    ownerUserId: string
    ids: string[]
    field: string
  }
) {
  const before = await getWorkshopImageIds(tx, edit.workshopId)
  const added = edit.ids.filter((id) => !before.includes(id))
  if (added.length > 0)
    await uploads.attachMedia(tx, {
      ownerUserId: edit.ownerUserId,
      ids: added,
      kept: [],
      field: edit.field,
      imagesOnly: true,
    })
  await w.replaceWorkshopImages(tx, edit.workshopId, edit.ids)
  await uploads.deleteMediaFiles(
    tx,
    before.filter((id) => !edit.ids.includes(id))
  )
}
