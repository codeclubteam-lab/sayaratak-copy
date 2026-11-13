import { z } from "zod"

import { env } from "~/env"
import { clock } from "~/shared/time/clock"

import { IMAGE_WIDTHS, widthTransformation } from "./delivery"
import { isImageMime } from "./sniff"
import type { Delivery, FileStore, PutFile } from "./store"

const API = "https://api.cloudinary.com/v1_1"
// A8: the stored original is re-encoded on the way in, which drops EXIF and
// GPS, and is capped at 2560 px. Videos are capped at 1280 px and 2 Mbit/s.
const INCOMING_IMAGE = "c_limit,h_2560,q_auto:good,w_2560"
const INCOMING_VIDEO = "br_2m,c_limit,h_1280,q_auto,w_1280"
const EAGER_IMAGES = IMAGE_WIDTHS.map(widthTransformation).join("|")
// A8: the server-side download link of a private file lives 60 seconds and is used once.
const DOWNLOAD_SECONDS = 60

const uploadAnswerSchema = z.object({
  public_id: z.string(),
  width: z.number().int().default(0),
  height: z.number().int().default(0),
  // `colors: true` asks for these: [["#7A8580", 31.2], ...], most used first.
  colors: z.array(z.tuple([z.string(), z.number()])).optional(),
})

type Credentials = { cloudName: string; apiKey: string; apiSecret: string }

/** The real file host, over Cloudinary's signed REST API (no SDK; see Deviations). */
export function cloudinaryStore(url: string): FileStore {
  const credentials = parseUrl(url)
  return {
    cloudName: credentials.cloudName,
    async put(file) {
      const answer = await call(
        credentials,
        `${resourceOf(file.mime)}/upload`,
        {
          params: uploadParams(file),
          file: new Blob([file.bytes], { type: file.mime }),
        }
      )
      const stored = uploadAnswerSchema.parse(answer)
      return {
        publicId: stored.public_id,
        width: stored.width,
        height: stored.height,
        placeholderColor: stored.colors?.[0]?.[0].toLowerCase() ?? null,
      }
    },
    async read(file) {
      const link = downloadUrl(credentials, file.publicId, file.mime)
      const response = await fetch(link)
      if (!response.ok)
        throw new Error(`Cloudinary download ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    async remove(file) {
      await call(credentials, `${resourceOf(file.mime)}/destroy`, {
        params: {
          public_id: file.publicId,
          type: typeOf(file.delivery),
          invalidate: "true",
        },
      })
    },
  }
}

function uploadParams(file: PutFile): Record<string, string> {
  const image = isImageMime(file.mime)
  const params: Record<string, string> = {
    type: typeOf(file.delivery),
    folder: `sayaratak/${env.APP_ENV}/${file.folder}`,
    transformation: image ? INCOMING_IMAGE : INCOMING_VIDEO,
  }
  if (!image) return params
  params.colors = "true"
  if (file.delivery === "public") params.eager = EAGER_IMAGES
  return params
}

async function call(
  credentials: Credentials,
  path: string,
  body: { params: Record<string, string>; file?: Blob }
) {
  const form = new FormData()
  for (const [key, value] of Object.entries(signed(credentials, body.params)))
    form.set(key, value)
  if (body.file) form.set("file", body.file, "upload")
  const response = await fetch(`${API}/${credentials.cloudName}/${path}`, {
    method: "POST",
    body: form,
  })
  const answer: unknown = await response.json()
  if (!response.ok)
    throw new Error(
      `Cloudinary ${path} ${response.status}: ${JSON.stringify(answer)}`
    )
  return answer
}

function downloadUrl(credentials: Credentials, publicId: string, mime: string) {
  const now = Math.floor(clock.now().getTime() / 1000)
  const params = signed(credentials, {
    public_id: publicId,
    format: mime.split("/")[1] ?? "",
    type: "private",
    expires_at: String(now + DOWNLOAD_SECONDS),
  })
  return `${API}/${credentials.cloudName}/${resourceOf(mime)}/download?${new URLSearchParams(params)}`
}

// Cloudinary's signature: the parameters sorted by name, joined as
// `a=1&b=2`, the API secret appended, SHA-1 in hex. `timestamp` is signed,
// `api_key` and the file are not. Example: { type: "private", timestamp: "9" }
// signs "timestamp=9&type=private<secret>".
function signed(credentials: Credentials, params: Record<string, string>) {
  const all: Record<string, string> = {
    ...params,
    timestamp: String(Math.floor(clock.now().getTime() / 1000)),
  }
  const payload = Object.keys(all)
    .sort()
    .map((key) => `${key}=${all[key]}`)
    .join("&")
  const signature = new Bun.CryptoHasher("sha1")
    .update(payload + credentials.apiSecret)
    .digest("hex")
  return { ...all, api_key: credentials.apiKey, signature }
}

// `cloudinary://<key>:<secret>@<cloud name>`, as the Cloudinary console shows it.
function parseUrl(url: string): Credentials {
  const parsed = new URL(url)
  return {
    cloudName: parsed.hostname,
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
  }
}

function resourceOf(mime: string) {
  return mime.startsWith("video/") ? "video" : "image"
}

function typeOf(delivery: Delivery) {
  return delivery === "private" ? "private" : "upload"
}
