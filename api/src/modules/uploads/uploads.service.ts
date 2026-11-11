import { env } from "~/env"
import { db } from "~/shared/db/client"
import type { Executor } from "~/shared/db/tx"
import {
  IMAGE_WIDTHS,
  imageTemplate,
  pickWidth,
  videoUrl,
  WIDTH_SLOT,
} from "~/shared/files/delivery"
import { demoFile } from "~/shared/files/demo"
import { files } from "~/shared/files/store"
import { fail } from "~/shared/http/errors"
import type { SessionUser } from "~/modules/auth/auth.types"

import * as q from "./uploads.queries"

export type UploadRow = NonNullable<Awaited<ReturnType<typeof q.getUpload>>>

// Private files are streamed by the API, so their address is on the API's own
// origin: web pages run on another origin of the same site and the session
// cookie still goes along (SameSite=Lax, A12).
const PRIVATE_URL_PREFIX = new URL("/api/v1/uploads/", env.BETTER_AUTH_URL).href

/**
 * What `GET /uploads/:id` answers: a public file redirects to its CDN address
 * at the asked width; a private one is streamed, to its owner or an admin
 * only. Anyone else gets 404, so the id tells nothing.
 */
export async function openUpload(request: {
  id: string
  viewer: SessionUser | null
  width?: string
}) {
  const row = await q.getUpload(db, request.id)
  if (!row) fail.notFound()
  if (row.delivery === "public")
    return { location: publicAddress(row, Number(request.width)) }
  const viewer = request.viewer
  if (!viewer || (viewer.id !== row.ownerUserId && viewer.role !== "admin"))
    fail.notFound()
  return readPrivate(row)
}

/** The address a page shows for an upload, or undefined without one. */
export async function uploadUrl(ex: Executor, id: string | null) {
  if (!id) return undefined
  const row = await q.getUpload(ex, id)
  return row ? toUrl(row) : undefined
}

const WIDTH_VARIANTS = [WIDTH_SLOT, ...IMAGE_WIDTHS] as const

function cloudinaryIdFromUrl(url: string) {
  const base = imageTemplate(files.cloudName, "")
  for (const width of WIDTH_VARIANTS) {
    const prefix = base.replace(WIDTH_SLOT, String(width))
    if (url.startsWith(prefix)) return url.slice(prefix.length)
  }
  return undefined
}

/** The user's own image upload behind an address the web sends back (an avatar). */
export function getOwnImageId(
  ex: Executor,
  image: { ownerUserId: string; url: string }
) {
  const cloudinaryId = cloudinaryIdFromUrl(image.url)
  if (cloudinaryId === undefined) return q.getImageIdByUrl(ex, image)
  return q.getImageIdByCloudinaryId(ex, {
    ownerUserId: image.ownerUserId,
    cloudinaryId,
  })
}

/**
 * The address a page shows: demo files keep their own, Cloudinary files get a
 * delivery URL, private files the API's streaming route.
 */
export function toUrl(row: UploadRow) {
  if (row.url) return row.url
  if (row.delivery === "private") return PRIVATE_URL_PREFIX + row.id
  const publicId = row.cloudinaryId ?? ""
  if (row.kind === "video")
    return videoUrl(files.cloudName, publicId, row.mime ?? "")
  return imageTemplate(files.cloudName, publicId)
}

// Demo photos live on the web server (`/mock/...`), so their address gets the web origin.
function publicAddress(row: UploadRow, width: number) {
  const address = toUrl(row).replace(WIDTH_SLOT, String(pickWidth(width)))
  return address.startsWith("/")
    ? new URL(address, env.WEB_ORIGIN).href
    : address
}

async function readPrivate(row: UploadRow) {
  if (!row.url) {
    const bytes = await files.read({
      publicId: row.cloudinaryId ?? "",
      mime: row.mime ?? "",
    })
    return { bytes, mime: row.mime ?? "" }
  }
  // Seeded receipts and documents: files in api/demo, development and test only.
  const demo = demoFile(row.url)
  if (!demo || !(await demo.exists())) fail.notFound()
  return { bytes: new Uint8Array(await demo.arrayBuffer()), mime: demo.type }
}
