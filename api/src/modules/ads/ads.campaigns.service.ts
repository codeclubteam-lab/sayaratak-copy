import type { campaignInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { newId } from "~/shared/text/ids"
import { clock } from "~/shared/time/clock"
import type { SessionUser } from "~/modules/auth/auth.types"
import * as uploads from "~/modules/uploads/uploads.service"
import { attachMedia } from "~/modules/uploads/uploads.media.service"

import * as campaignsQ from "./ads.campaigns.queries"
import { toCampaign } from "./ads.mapper"
import { getOwnerNames } from "./ads.owner.service"
import { lockRoom, rangeOf } from "./ads.pages.service"
import * as q from "./ads.queries"
import { listAdTargets } from "./ads.targets.service"

const ID_PREFIX = "camp"

/** `GET /me/campaigns`: the advertiser's campaigns, newest first. */
export async function listMyCampaigns(user: SessionUser) {
  const [rows, owner] = await Promise.all([
    campaignsQ.listCampaignsOf(db, user.id),
    getOwnerNames(db, user.id),
  ])
  return Promise.all(
    rows.map(async (row) =>
      toCampaign(row, {
        ownerName: owner.en,
        imageUrl: (await uploads.uploadUrl(db, row.imageUploadId)) ?? "",
      })
    )
  )
}

/**
 * `POST /campaigns`: a banner for 1 to 4 weeks on the chosen pages, unpaid
 * until its receipt is sent. The price is the pages' weekly prices times the
 * weeks, from the held page rows, never the client. 422 for a link that is
 * not the advertiser's own, a page that is off sale or a campaign that has
 * already ended; 409 `page_full` when a page has no free slot in the dates.
 */
export async function createCampaign(
  user: SessionUser,
  input: z.output<typeof campaignInputSchema>
) {
  const targets = await listAdTargets(db, user)
  if (!targets.some((target) => target.href === input.href))
    fail.validation({ href: "validation.ad_target" })
  const pages = [...new Set(input.pages)]
  const onSale = new Set(
    (await q.listPages(db)).filter((p) => p.enabled).map((p) => p.id)
  )
  if (!pages.every((id) => onSale.has(id)))
    fail.validation({ pages: "validation.ad_pages" })
  const range = rangeOf(input.startDate, input.weeks)
  if (!range || range.endsAt <= clock.now())
    fail.validation({ startDate: "validation.date" })
  return transaction(async (tx) => {
    const held = await lockRoom(tx, { ...range, pages })
    const imageId = await uploads.getOwnImageId(tx, {
      ownerUserId: user.id,
      url: input.creative.imageUrl,
    })
    if (!imageId) fail.validation({ "creative.imageUrl": "validation.url" })
    await attachMedia(tx, {
      ownerUserId: user.id,
      ids: [imageId],
      kept: [],
      field: "creative.imageUrl",
      imagesOnly: true,
    })
    const saved = await campaignsQ.insertCampaign(tx, {
      id: newId(ID_PREFIX),
      ownerId: user.id,
      imageUploadId: imageId,
      copy: input.creative.copy,
      href: input.href,
      pages,
      startsAt: range.startsAt,
      weeks: input.weeks,
      endsAt: range.endsAt,
      createdAt: clock.now(),
      amount:
        held.reduce((sum, page) => sum + page.weeklyPrice, 0) * input.weeks,
    })
    return toCampaign(saved, {
      ownerName: (await getOwnerNames(tx, user.id)).en,
      imageUrl: input.creative.imageUrl,
    })
  })
}
