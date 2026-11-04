import type { AdminCampaign } from "@sayaratak/shared/schemas/ads"
import type { adPagePatchSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { both } from "~/shared/text/bilingual"
import * as ads from "~/modules/ads/ads.admin.service"
import type { Actor } from "~/modules/audit/audit.types"
import { notify } from "~/modules/notifications/notifications.service"
import { decideCampaignReceipt } from "~/modules/payments/payments.decide.service"
import { listCampaignReceiptUrls } from "~/modules/payments/payments.admin.service"

/** `GET /admin/campaigns`: every campaign with the receipt it was paid with; the ones waiting come first. */
export async function getCampaigns() {
  const campaigns = await ads.listAdminCampaigns(db)
  return withReceipts(db, campaigns)
}

/**
 * `POST /admin/campaigns/:id/approve`: approves the banner and the receipt sent for it
 * together, and tells the advertiser. Only a campaign waiting for review (409 `exists`).
 * Answers the campaign without the receipt, as the mock does.
 */
export function approveCampaign(actor: Actor, id: string) {
  return transaction(async (tx) => {
    await ads.approveUnderReview(tx, actor, id)
    await decideCampaignReceipt(tx, actor, {
      campaignId: id,
      status: "approved",
    })
    const campaign = await ads.getAdminCampaign(tx, id)
    if (campaign.ownerId)
      await notify(tx, {
        userId: campaign.ownerId,
        type: "payment_approved",
        title: {
          ar: "تمت الموافقة على إعلانك",
          en: "Your banner campaign is approved",
        },
        body: {
          ar: campaign.creative.copy.ar.heading,
          en: campaign.creative.copy.en.heading,
        },
        href: "/ads",
      })
    return campaign
  })
}

/** `POST /admin/campaigns/:id/reject`: rejects the banner and its receipt with the reason, and tells the advertiser. */
export function rejectCampaign(
  actor: Actor,
  rejection: { id: string; reason: string }
) {
  return transaction(async (tx) => {
    await ads.rejectUnderReview(tx, actor, rejection)
    await decideCampaignReceipt(tx, actor, {
      campaignId: rejection.id,
      status: "rejected",
      reason: rejection.reason,
    })
    const campaign = await ads.getAdminCampaign(tx, rejection.id)
    if (campaign.ownerId)
      await notify(tx, {
        userId: campaign.ownerId,
        type: "payment_rejected",
        title: {
          ar: "تم رفض إعلانك",
          en: "Your banner campaign was rejected",
        },
        body: both(rejection.reason),
        href: "/ads",
      })
    return campaign
  })
}

/** `GET /admin/ad-pages`: every page that sells space, switched off ones too. */
export function getAdPages() {
  return ads.listAdminAdPages(db)
}

/** `PATCH /admin/ad-pages/:id`: the page as it is after. */
export function changeAdPage(
  actor: Actor,
  change: { id: string; edit: z.output<typeof adPagePatchSchema> }
) {
  return transaction((tx) => ads.updateAdPage(tx, actor, change))
}

// The receipt of each campaign comes from the payments module; a campaign with none has null.
async function withReceipts(
  ex: Executor,
  campaigns: Awaited<ReturnType<typeof ads.listAdminCampaigns>>
): Promise<AdminCampaign[]> {
  const urls = await listCampaignReceiptUrls(
    ex,
    campaigns.map((campaign) => campaign.id)
  )
  return campaigns.map((campaign) => ({
    ...campaign,
    receiptUrl: urls.get(campaign.id) ?? null,
  }))
}
