import type { bannerInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { attachMedia } from "~/modules/uploads/uploads.media.service"
import { getOwnImageId, uploadUrl } from "~/modules/uploads/uploads.service"

import type { BannerRow } from "./ads.banners.admin.queries"

const LANGUAGES = ["ar", "en"] as const
const IMAGE_COLUMNS = {
  ar: "imageArUploadId",
  en: "imageEnUploadId",
} as const

type Language = (typeof LANGUAGES)[number]
type ImageUrl = z.output<typeof bannerInputSchema>["imageUrl"]

// The admin's own image upload behind an address the form sends back; 422 on that language's field.
export async function resolveImage(
  tx: Transaction,
  find: { admin: string; url: string; language: Language }
) {
  const id = await getOwnImageId(tx, {
    ownerUserId: find.admin,
    url: find.url,
  })
  if (!id) fail.validation({ [`imageUrl.${find.language}`]: "validation.url" })
  return id
}

// Marks new pictures attached, so the orphan cleanup leaves them alone.
export async function attachImages(
  tx: Transaction,
  attach: { admin: string; ids: string[]; kept?: string[] }
) {
  if (attach.ids.length === 0) return
  await attachMedia(tx, {
    ownerUserId: attach.admin,
    ids: uniqueIds(attach.ids),
    kept: attach.kept ?? [],
    field: "imageUrl",
    imagesOnly: true,
  })
}

// A language sent with its current address keeps its picture; any other gets the admin's new upload.
export async function replaceImages(
  tx: Transaction,
  find: {
    admin: string
    row: BannerRow
    imageUrl: ImageUrl
  }
) {
  const columns: Partial<BannerRow> = {}
  for (const language of LANGUAGES) {
    const column = IMAGE_COLUMNS[language]
    const url = find.imageUrl[language]
    if ((await uploadUrl(tx, find.row[column])) === url) continue
    const id = await resolveImage(tx, {
      admin: find.admin,
      url,
      language,
    })
    if (id !== find.row[column]) columns[column] = id
  }
  await attachImages(tx, {
    admin: find.admin,
    ids: LANGUAGES.flatMap(
      (language) => columns[IMAGE_COLUMNS[language]] ?? []
    ),
    kept: uniqueIds(imageIdsOf(find.row)),
  })
  const kept = new Set(
    LANGUAGES.map(
      (language) =>
        columns[IMAGE_COLUMNS[language]] ?? find.row[IMAGE_COLUMNS[language]]
    )
  )
  const dropped = uniqueIds(imageIdsOf(find.row)).filter((id) => !kept.has(id))
  return { columns, dropped }
}

export function imageIdsOf(row: BannerRow) {
  return [row.imageArUploadId, row.imageEnUploadId]
}

export function uniqueIds(ids: string[]) {
  return [...new Set(ids)]
}
