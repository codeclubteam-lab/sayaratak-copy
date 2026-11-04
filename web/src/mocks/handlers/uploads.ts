import { uploadSchema } from "@sayaratak/shared/schemas/api"
import { uploadFormSchema } from "@sayaratak/shared/schemas/inputs"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"

import { db, newId } from "../db"
import { fail, needUser, route, zodFields } from "../http"

const MB = 1024 * 1024
const VIDEO_BYTES = 30 * MB
const POSTER_BYTES = MB

// Files live in a server-side Map; the url is served by GET /uploads/:id.
export async function storeUpload(
  file: File,
  limit = 5 * MB,
  tooLarge = "validation.file_size_5mb"
) {
  if (file.size > limit) throw fail(422, "validation", { file: tooLarge })
  const id = newId("up")
  db.uploads.set(id, {
    id,
    name: file.name,
    type: file.type,
    bytes: await file.arrayBuffer(),
  })
  const kind = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : "file"
  return uploadSchema.parse({
    id,
    url: `/api/uploads/${id}`,
    type: kind,
    name: file.name,
    size: file.size,
  })
}

export const template = (id: string) => `/api/uploads/${id}?w={w}`

// Returns a Media. A real backend reads width, height and the dominant color from the file;
// the mock takes them from the client, which already decoded the image, and serves the original for every `{w}`.
// Signed in only (owner, 2026-11-01): the post wizard asks for sign in at the photos step.
route("POST", "/uploads", async (c) => {
  needUser(c)
  const form = await c.form()
  const parsed = uploadFormSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) throw fail(422, "validation", zodFields(parsed.error))
  const file = parsed.data.file
  const video = file.type.startsWith("video/")
  if (
    !video &&
    (!file.type.startsWith("image/") || file.type === "image/svg+xml")
  )
    throw fail(422, "validation", { file: "validation.image_type" })
  const stored = video
    ? await storeUpload(file, VIDEO_BYTES, "validation.video_size")
    : await storeUpload(file)
  const poster = parsed.data.poster
  const posterRow =
    video && poster ? await storeUpload(poster, POSTER_BYTES) : null
  const media = mediaSchema.parse({
    id: stored.id,
    type: video ? "video" : "image",
    url: template(stored.id),
    width: Number(form.get("width")) || 0,
    height: Number(form.get("height")) || 0,
    placeholderColor: String(form.get("placeholderColor") ?? "#c9d3cf"),
    posterUrl: posterRow ? template(posterRow.id) : null,
  })
  const row = db.uploads.get(stored.id)
  if (row) row.media = media
  return Response.json(media, { status: 201 })
})

route("GET", "/uploads/:id", (c) => {
  const row = db.uploads.get(c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  return new Response(row.bytes, {
    headers: {
      "content-type": row.type || "application/octet-stream",
      "cache-control": "public, max-age=3600",
    },
  })
})
