import type { Media } from "@sayaratak/shared/schemas/listing"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"

import { queueHostDeletes } from "./uploads.host.service"
import { toMedia } from "./uploads.mapper"
import * as q from "./uploads.queries"
import { toUrl, type UploadRow } from "./uploads.service"

const ID_PREFIX = "up"
const MEDIA_KINDS = new Set(["image", "video"])
const IMAGE_KINDS = new Set(["image"])
const DEFAULT_FIELD = "media"

/** Each photo or video with these ids as a `Media`, keyed by id. Unknown ids are left out. */
export async function getMediaOf(ex: Executor, ids: string[]) {
  const rows = await q.listUploads(ex, ids)
  const posters = await q.listUploads(ex, posterIdsOf(rows))
  const posterById = new Map(posters.map((row) => [row.id, row]))
  const media = new Map<string, Media>()
  for (const row of rows) {
    const poster = row.posterId ? posterById.get(row.posterId) : undefined
    media.set(
      row.id,
      toMedia(
        { row, url: toUrl(row) },
        poster ? { row: poster, url: toUrl(poster) } : null
      )
    )
  }
  return media
}

/**
 * Marks photos and videos attached to something (A8). Each must be the
 * owner's own public photo or video, and either new or already one of
 * `kept` (the target's current media); anything else is 422 on `field`
 * (`media` unless the caller names the form field). `imagesOnly` refuses
 * videos, for logos, avatars and portfolio pictures.
 */
export async function attachMedia(
  tx: Transaction,
  attach: {
    ownerUserId: string
    ids: string[]
    kept: string[]
    field?: string
    imagesOnly?: boolean
  }
) {
  const rows = await q.listUploads(tx, attach.ids)
  const kinds = attach.imagesOnly ? IMAGE_KINDS : MEDIA_KINDS
  const usable = rows.filter(
    (row) =>
      row.ownerUserId === attach.ownerUserId &&
      kinds.has(row.kind) &&
      row.delivery === "public" &&
      (row.attachedAt === null || attach.kept.includes(row.id))
  )
  // The web's photo field shows "Required" next to the photos; no finer key exists.
  if (usable.length !== new Set(attach.ids).size)
    fail.validation({ [attach.field ?? DEFAULT_FIELD]: "validation.required" })
  const ids = [...attach.ids, ...posterIdsOf(rows)]
  await q.updateAttached(tx, { ids, at: clock.now() })
}

/**
 * Copies upload rows for a duplicated listing: new ids, same file. The file
 * host keeps one copy; `deleteMediaFiles` removes it only once no row uses it.
 */
export async function copyMedia(
  tx: Transaction,
  copy: { ids: string[]; ownerUserId: string }
) {
  const rows = await q.listUploads(tx, copy.ids)
  const posters = await q.listUploads(tx, posterIdsOf(rows))
  const now = clock.now()
  const posterCopies = new Map(posters.map((row) => [row.id, newId(ID_PREFIX)]))
  const copyOf = (row: UploadRow, id: string, posterId: string | null) => ({
    ...row,
    id,
    posterId,
    ownerUserId: copy.ownerUserId,
    attachedAt: now,
    createdAt: now,
  })
  await q.insertUploads(
    tx,
    posters.map((row) => copyOf(row, posterCopies.get(row.id) ?? "", null))
  )
  const byId = new Map(rows.map((row) => [row.id, row]))
  const ids = copy.ids.map(() => newId(ID_PREFIX))
  await q.insertUploads(
    tx,
    copy.ids.flatMap((id, i) => {
      const row = byId.get(id)
      if (!row) return []
      const posterId = row.posterId
        ? (posterCopies.get(row.posterId) ?? null)
        : null
      return [copyOf(row, ids[i] ?? "", posterId)]
    })
  )
  return ids
}

/**
 * Deletes upload rows (and their posters), then, after the commit, each file
 * on the host that no other row still uses (A8). A failed host delete never
 * blocks the user: its note stays and the orphan job tries again.
 */
export async function deleteMediaFiles(tx: Transaction, ids: string[]) {
  const rows = await q.listUploads(tx, ids)
  const deleted = await q.deleteUploads(tx, [...ids, ...posterIdsOf(rows)])
  await queueHostDeletes(tx, deleted)
}

function posterIdsOf(rows: UploadRow[]) {
  return rows.flatMap((row) => (row.posterId ? [row.posterId] : []))
}

/** Ids of every video upload, for the "has video" search filter. */
export function listVideoIds(ex: Executor) {
  return q.listVideoIds(ex)
}
