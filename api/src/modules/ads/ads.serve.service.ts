import { adPageIdSchema } from "@sayaratak/shared/schemas/ads"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { uploadUrl } from "~/modules/uploads/uploads.service"

import { pickRunning } from "./ads.campaigns.queries"
import { toSponsoredBanner } from "./ads.mapper"
import { getOwnerNames } from "./ads.owner.service"

/**
 * `GET /ads`: the paid banner of a page: one running campaign, picked at
 * random on each request. An unknown page or an unsold one gives none; the
 * web then shows the house banners (`GET /banners`).
 */
export async function serveAds(pageParam: string | undefined) {
  const page = adPageIdSchema.safeParse(pageParam).data
  if (!page) return []
  const row = await pickRunning(db, { page, now: clock.now() })
  if (!row) return []
  const [owner, imageUrl] = await Promise.all([
    getOwnerNames(db, row.ownerId),
    uploadUrl(db, row.imageUploadId),
  ])
  return [toSponsoredBanner(row, { page, owner, imageUrl: imageUrl ?? "" })]
}
