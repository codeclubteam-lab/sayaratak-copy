import { req, type SignedIn } from "./helpers"

// The smallest byte runs that pass the magic-number check (sniffMime). The
// fake file store never decodes them.
const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const WEBP = [...bytesOf("RIFF"), 0, 0, 0, 0, ...bytesOf("WEBPVP8 ")]
const MP4 = [0, 0, 0, 0x18, ...bytesOf("ftypmp42")]
const SIGNATURES = { jpeg: JPEG, png: PNG, webp: WEBP, mp4: MP4 }

/** A file whose first bytes prove `type`, padded to `size` bytes. */
export function fileOf(
  type: keyof typeof SIGNATURES,
  options: { size?: number; declared?: string; name?: string } = {}
) {
  const bytes = new Uint8Array(options.size ?? 64)
  bytes.set(SIGNATURES[type])
  const declared =
    options.declared ?? (type === "mp4" ? "video/mp4" : `image/${type}`)
  return new File([bytes], options.name ?? `file.${type}`, { type: declared })
}

/** A text file, such as an SVG that claims to be an image. */
export function textFile(text: string, declared: string) {
  return new File([text], "file.svg", { type: declared })
}

/** `POST /uploads` as a signed-in browser, with the multipart fields given. */
export function postUpload(
  as: SignedIn,
  fields: Record<string, File | string>,
  headers: Record<string, string> = {}
) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return req("/uploads", {
    method: "POST",
    headers: { cookie: as.cookie, origin: as.origin, ...headers },
    body: form,
  })
}

function bytesOf(text: string) {
  return [...new TextEncoder().encode(text)]
}

/** `POST /me/verification` as a signed-in browser: one `label` and `file` per document, then the `note`. */
export function postVerification(
  as: SignedIn,
  documents: { label: string; file: File }[],
  note?: string
) {
  const form = new FormData()
  for (const { label, file } of documents) {
    form.append("label", label)
    form.append("file", file)
  }
  if (note !== undefined) form.set("note", note)
  return req("/me/verification", {
    method: "POST",
    headers: { cookie: as.cookie, origin: as.origin },
    body: form,
  })
}

/** `POST /payments` as a signed-in browser: the text fields, and the receipt unless it is left out. */
export function postPayment(
  as: SignedIn,
  fields: Record<string, string>,
  receipt: File | null = fileOf("jpeg")
) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  if (receipt) form.set("receipt", receipt)
  return req("/payments", {
    method: "POST",
    headers: { cookie: as.cookie, origin: as.origin },
    body: form,
  })
}
