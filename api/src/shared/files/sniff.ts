/** The file types an upload may have, read from the bytes, never from the client. */
export type MediaMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/webm"

// Magic numbers: JPEG starts FF D8 FF, PNG with 89 "PNG", WebP is "RIFF" then
// "WEBP" at byte 8, MP4 has "ftyp" at byte 4, WebM (Matroska) starts 1A 45 DF A3.
// SVG is text, so it never matches and is refused (it can carry script).
const SIGNATURES: { mime: MediaMime; offset: number; bytes: number[] }[] = [
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  { mime: "video/mp4", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  { mime: "video/webm", offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
]
const RIFF = [0x52, 0x49, 0x46, 0x46]

/** The type the first bytes of a file prove, or null for anything else. */
export function sniffMime(head: Uint8Array): MediaMime | null {
  for (const signature of SIGNATURES) {
    if (!startsWith(head, signature.bytes, signature.offset)) continue
    if (signature.mime === "image/webp" && !startsWith(head, RIFF, 0)) continue
    return signature.mime
  }
  return null
}

export function isImageMime(mime: MediaMime) {
  return mime.startsWith("image/")
}

function startsWith(head: Uint8Array, bytes: number[], offset: number) {
  return bytes.every((byte, i) => head[offset + i] === byte)
}
