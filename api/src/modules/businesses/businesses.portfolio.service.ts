import type { Mechanic } from "@sayaratak/shared/schemas/profile"

import type { Executor, Transaction } from "~/shared/db/tx"
import { newId } from "~/shared/text/ids"
import * as uploads from "~/modules/uploads/uploads.media.service"

import { toPortfolioItem } from "./businesses.profile.mapper"
import { listPortfolio as listRows } from "./businesses.profile.queries"
import * as q from "./businesses.portfolio.queries"

export type PortfolioItem = Mechanic["portfolio"][number]

const ID_PREFIX = "pf"
// Larger than any portfolio, so shifted positions never meet the final ones.
const SHIFT = 1_000_000

/** The mechanic's portfolio in the owner's order. */
export async function listPortfolio(ex: Executor, mechanicId: string) {
  const rows = await listRows(ex, [mechanicId])
  const media = await uploads.getMediaOf(
    ex,
    rows.map((row) => row.uploadId)
  )
  return rows.flatMap((row) => {
    const shown = media.get(row.uploadId)
    return shown ? [toPortfolioItem(row, shown)] : []
  })
}

/** How many pictures the mechanic's portfolio has. */
export async function countPortfolio(ex: Executor, mechanicId: string) {
  return (await listRows(ex, [mechanicId])).length
}

/**
 * Adds a picture at the end. `imageId` must be the owner's own unused image
 * upload (422 on `imageId` otherwise); it is attached to the item.
 */
export async function addPortfolioItem(
  tx: Transaction,
  add: {
    mechanicId: string
    ownerUserId: string
    imageId: string
    caption: string
  }
) {
  await uploads.attachMedia(tx, {
    ownerUserId: add.ownerUserId,
    ids: [add.imageId],
    kept: [],
    field: "imageId",
    imagesOnly: true,
  })
  const rows = await listRows(tx, [add.mechanicId])
  const row = {
    id: newId(ID_PREFIX),
    mechanicId: add.mechanicId,
    uploadId: add.imageId,
    caption: add.caption,
    position: (rows.at(-1)?.position ?? -1) + 1,
  }
  await q.insertPortfolioRow(tx, row)
  const media = (await uploads.getMediaOf(tx, [add.imageId])).get(add.imageId)
  return media ? toPortfolioItem(row, media) : undefined
}

/**
 * Changes a picture's caption and optionally replaces the upload; undefined when
 * the mechanic has no such item.
 */
export async function updatePortfolioItem(
  tx: Transaction,
  edit: {
    mechanicId: string
    id: string
    caption: string
    imageId?: string
    ownerUserId: string
  }
) {
  const row = await q.getPortfolioRow(tx, edit)
  if (!row) return undefined
  const oldUploadId = row.uploadId
  const replaced = Boolean(edit.imageId && edit.imageId !== oldUploadId)
  const uploadId = replaced && edit.imageId ? edit.imageId : oldUploadId
  if (replaced && edit.imageId) {
    await uploads.attachMedia(tx, {
      ownerUserId: edit.ownerUserId,
      ids: [edit.imageId],
      kept: [oldUploadId],
      field: "imageId",
      imagesOnly: true,
    })
  }
  await q.updatePortfolioRow(tx, row.id, {
    caption: edit.caption,
    uploadId,
  })
  if (replaced) {
    await uploads.deleteMediaFiles(tx, [oldUploadId])
  }
  const media = (await uploads.getMediaOf(tx, [uploadId])).get(uploadId)
  return media
    ? toPortfolioItem({ ...row, caption: edit.caption }, media)
    : undefined
}

/** Removes a picture and its file; an id the mechanic does not have changes nothing. */
export async function deletePortfolioItem(
  tx: Transaction,
  find: { mechanicId: string; id: string }
) {
  const row = await q.deletePortfolioRow(tx, find)
  if (row) await uploads.deleteMediaFiles(tx, [row.uploadId])
}

/**
 * Puts the pictures named in `ids` first, in that order, and keeps the others
 * after them in their old order: a reorder never deletes. Unknown and repeated
 * ids are skipped. Example: `[c, a]` over `[a, b, c]` gives `[c, a, b]`.
 */
export async function reorderPortfolio(
  tx: Transaction,
  reorder: { mechanicId: string; ids: string[] }
) {
  const rows = await listRows(tx, [reorder.mechanicId])
  const byId = new Map(rows.map((row) => [row.id, row]))
  const named = [...new Set(reorder.ids)].flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
  const order = [...named, ...rows.filter((row) => !named.includes(row))]
  await q.shiftPortfolioPositions(tx, {
    mechanicId: reorder.mechanicId,
    by: SHIFT,
  })
  for (const [position, row] of order.entries())
    await q.updatePortfolioRow(tx, row.id, { position })
  return listPortfolio(tx, reorder.mechanicId)
}
