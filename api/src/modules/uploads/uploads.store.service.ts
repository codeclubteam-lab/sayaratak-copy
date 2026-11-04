import type { uploadFormSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { type Executor, transaction } from "~/shared/db/tx"
import { type MediaMime, isImageMime, sniffMime } from "~/shared/files/sniff"
import { files } from "~/shared/files/store"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"

import { toMedia, toUpload } from "./uploads.mapper"
import * as q from "./uploads.queries"
import { toUrl } from "./uploads.service"

type UploadForm = z.output<typeof uploadFormSchema>
type PrivateKind = "receipt" | "document"

const MB = 1024 * 1024
// Handoff "Uploads": images, receipts and documents 5 MB, video 30 MB, poster 1 MB.
const IMAGE_MAX_BYTES = 5 * MB
const VIDEO_MAX_BYTES = 30 * MB
const POSTER_MAX_BYTES = MB
// Enough bytes for every magic number sniffMime reads.
const HEAD_BYTES = 16
const ID_PREFIX = "up"

/** Stores a listing, business or portfolio photo, or a video with its first-frame poster. Width, height and color come from the stored file. */
export async function storeMedia(user: SessionUser, form: UploadForm) {
  const file = await readChecked(form.file)
  // The mock reports a too-large poster with the 5 MB key under `file`; the web reads only `file`.
  const poster =
    file.mime.startsWith("video/") && form.poster
      ? await readChecked(form.poster, POSTER_MAX_BYTES)
      : null
  if (poster && !isImageMime(poster.mime))
    fail.validation({ file: "validation.image_type" })
  // The file host first: a row must never point at a file that is not there.
  const storedPoster = poster
    ? await files.put({ ...poster, delivery: "public", folder: "images" })
    : null
  const stored = await files.put({
    ...file,
    delivery: "public",
    folder: folderOf(file.mime),
  })
  const rows = await transaction(async (tx) => {
    const posterRow =
      storedPoster && poster
        ? await insertStored(tx, { user, file: poster, stored: storedPoster })
        : null
    const fileRow = await insertStored(tx, {
      user,
      file,
      stored,
      posterId: posterRow?.id,
    })
    return { file: fileRow, poster: posterRow }
  })
  return toMedia(
    { row: rows.file, url: toUrl(rows.file) },
    rows.poster ? { row: rows.poster, url: toUrl(rows.poster) } : null
  )
}

/**
 * Stores a payment receipt or verification document as a private file (A8).
 * JPEG, PNG or WebP up to 5 MB. It is attached from the start: the payment or
 * request row is written in the same transaction, so no cleanup is due.
 */
export async function storePrivateFile(
  ex: Executor,
  upload: { user: SessionUser; file: File; kind: PrivateKind }
) {
  const file = await readChecked(upload.file)
  if (!isImageMime(file.mime))
    fail.validation({ file: "validation.image_type" })
  const stored = await files.put({
    ...file,
    delivery: "private",
    folder: `${upload.kind}s`,
  })
  const row = await q.insertUpload(ex, {
    ...rowOf({ user: upload.user, file, stored }),
    kind: upload.kind,
    delivery: "private",
    attachedAt: clock.now(),
  })
  return toUpload({ row, url: toUrl(row), name: upload.file.name })
}

async function readChecked(file: File, maxBytes?: number) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = sniffMime(bytes.subarray(0, HEAD_BYTES))
  const declaredVideo = file.type.startsWith("video/")
  if (!mime)
    fail.validation({
      file: declaredVideo ? "validation.video_type" : "validation.image_type",
    })
  const video = mime.startsWith("video/")
  if (video && bytes.length > (maxBytes ?? VIDEO_MAX_BYTES))
    fail.validation({ file: "validation.video_size" })
  if (!video && bytes.length > (maxBytes ?? IMAGE_MAX_BYTES))
    fail.validation({ file: "validation.file_size_5mb" })
  return { bytes, mime }
}

function insertStored(
  ex: Executor,
  upload: Parameters<typeof rowOf>[0] & { posterId?: string }
) {
  return q.insertUpload(ex, {
    ...rowOf(upload),
    kind: upload.file.mime.startsWith("video/") ? "video" : "image",
    delivery: "public",
    posterId: upload.posterId ?? null,
  })
}

function rowOf(upload: {
  user: SessionUser
  file: { bytes: Uint8Array<ArrayBuffer>; mime: MediaMime }
  stored: Awaited<ReturnType<typeof files.put>>
}) {
  return {
    id: newId(ID_PREFIX),
    ownerUserId: upload.user.id,
    cloudinaryId: upload.stored.publicId,
    width: upload.stored.width,
    height: upload.stored.height,
    placeholderColor: upload.stored.placeholderColor,
    bytes: upload.file.bytes.length,
    mime: upload.file.mime,
    createdAt: clock.now(),
  }
}

function folderOf(mime: MediaMime) {
  return isImageMime(mime) ? "images" : "videos"
}
