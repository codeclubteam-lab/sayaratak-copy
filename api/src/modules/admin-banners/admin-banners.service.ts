import type { bannerInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import * as banners from "~/modules/ads/ads.banners.admin.service"
import type { Actor } from "~/modules/audit/audit.types"

type BannerInput = z.output<typeof bannerInputSchema>

/** `GET /admin/banners`: every house banner by sort order, off and ended ones too. */
export function getBanners() {
  return banners.listAdminBanners(db)
}

/** `POST /admin/banners`: the new banner. */
export function addBanner(actor: Actor, input: BannerInput) {
  return transaction((tx) => banners.createBanner(tx, actor, input))
}

/** `PATCH /admin/banners/:id`: the banner as it is after. */
export function changeBanner(
  actor: Actor,
  change: { id: string; edit: Partial<BannerInput> }
) {
  return transaction((tx) => banners.updateBanner(tx, actor, change))
}

/** `DELETE /admin/banners/:id`. */
export function removeBanner(actor: Actor, id: string) {
  return transaction((tx) => banners.deleteBanner(tx, actor, id))
}
