import { bannerSchema } from "@sayaratak/shared/schemas/admin"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { uploadUrl } from "~/modules/uploads/uploads.service"

import { toBanner } from "./ads.mapper"
import * as q from "./ads.banners.queries"

/**
 * `GET /banners`: the house banners that are live now, for one placement or
 * all. An unknown placement matches none, as `GET /ads` does for a page.
 */
export async function listLiveBanners(placement: string | undefined) {
  const wanted = placement
    ? bannerSchema.shape.placement.safeParse(placement)
    : undefined
  if (wanted && !wanted.success) return []
  const rows = await q.listLive(db, {
    placement: wanted?.data,
    now: clock.now(),
  })
  return Promise.all(
    rows.map(async (row) =>
      toBanner(row, {
        ar: (await uploadUrl(db, row.imageArUploadId)) ?? "",
        en: (await uploadUrl(db, row.imageEnUploadId)) ?? "",
      })
    )
  )
}
