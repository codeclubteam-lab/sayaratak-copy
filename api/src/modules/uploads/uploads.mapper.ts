import type { Upload } from "@sayaratak/shared/schemas/api"
import type { Media } from "@sayaratak/shared/schemas/listing"

import type { UploadRow } from "./uploads.tables"

// Seeded photos and an image without a stored color show the mock's gray.
const DEFAULT_COLOR = "#c9d3cf"

type Addressed = { row: UploadRow; url: string }

/** A photo or video as listings, businesses and portfolios carry it. */
export function toMedia(file: Addressed, poster: Addressed | null): Media {
  return {
    id: file.row.id,
    type: file.row.kind === "video" ? "video" : "image",
    url: file.url,
    width: file.row.width ?? 0,
    height: file.row.height ?? 0,
    placeholderColor:
      file.row.placeholderColor ??
      poster?.row.placeholderColor ??
      DEFAULT_COLOR,
    posterUrl: poster?.url ?? null,
  }
}

/** A receipt or document as the payment and verification answers carry it. */
export function toUpload(file: Addressed & { name: string }): Upload {
  return {
    id: file.row.id,
    url: file.url,
    type: "file",
    name: file.name,
    size: file.row.bytes ?? 0,
  }
}
