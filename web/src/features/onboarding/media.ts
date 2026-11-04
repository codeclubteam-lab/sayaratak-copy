import { buildUrl } from "@/lib/api/client"
import type { Media } from "@sayaratak/shared/schemas/listing"

export const uploadTemplate = (id: string) =>
  `${buildUrl(`/uploads/${id}`)}?w={w}`

// A stored url (a user's avatar) as something the uploaders can show.
export const mediaFromUrl = (url: string): Media => ({
  id: url,
  type: "image",
  url,
  width: 0,
  height: 0,
  placeholderColor: "",
  posterUrl: null,
})

// Drafts keep only the media id; this gives the uploaders something to show again after a refresh or Back.
export const mediaFromId = (id: string): Media => ({
  ...mediaFromUrl(uploadTemplate(id)),
  id,
})
