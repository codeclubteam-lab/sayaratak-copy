import { uploadFormSchema } from "@sayaratak/shared/schemas/inputs"
import { mediaSchema } from "@sayaratak/shared/schemas/listing"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { z } from "zod"

import { fail } from "~/shared/http/errors"
import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { openUpload } from "./uploads.service"
import { storeMedia } from "./uploads.store.service"

// A video (30 MB) and its poster (1 MB) plus the multipart overhead. A bigger
// body is refused before it is read.
const BODY_MAX_BYTES = 32 * 1024 * 1024
// A private file is shown as it is and may never run script, even an SVG.
const PRIVATE_FILE_HEADERS = {
  "Content-Disposition": "inline",
  "Cache-Control": "private, no-store",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

export const uploadsRoutes = new Hono()

uploadsRoutes.post(
  "/uploads",
  // First, so neither the idempotency hash nor the form parse reads an oversized body.
  bodyLimit({
    maxSize: BODY_MAX_BYTES,
    onError: () => fail.validation({ file: "validation.video_size" }),
  }),
  spec({
    summary:
      "Upload a photo, or a video with its poster; answers the Media to attach",
    access: "user",
    responses: { 201: mediaSchema },
    errors: ["unauthenticated", "banned", "too_many_attempts"],
    idempotent: true,
  }),
  requireUser,
  rateLimit("uploads"),
  validate.form(uploadFormSchema),
  async (c) => {
    const media = await storeMedia(c.get("user"), c.req.valid("form"))
    return c.json(media, 201)
  }
)

uploadsRoutes.get(
  "/uploads/:id",
  spec({
    summary:
      "A file: public photos redirect to their CDN address (`?w=` 320, 640, 960 or 1280); receipts and documents stream to their owner or an admin",
    access: "public",
    responses: { 200: z.file() },
    errors: ["not_found"],
  }),
  async (c) => {
    const file = await openUpload({
      id: c.req.param("id"),
      viewer: c.get("viewer"),
      width: c.req.query("w"),
    })
    if ("location" in file) return c.redirect(file.location, 302)
    return c.body(file.bytes, 200, {
      ...PRIVATE_FILE_HEADERS,
      "Content-Type": file.mime,
    })
  }
)
