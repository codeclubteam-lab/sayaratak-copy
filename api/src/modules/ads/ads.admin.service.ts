import { adPageIdSchema } from "@sayaratak/shared/schemas/ads"
import type { adPagePatchSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"
import * as uploads from "~/modules/uploads/uploads.service"

import * as q from "./ads.admin.queries"
import { toAdPage, toCampaign } from "./ads.mapper"
import { getOwnerNames } from "./ads.owner.service"
import { approveCampaign } from "./ads.service"
import { lockCampaign, updateStatus } from "./ads.queries"

type AdPageEdit = z.output<typeof adPagePatchSchema>

/** Every campaign: the ones waiting for the admin first, then newest first. */
export async function listAdminCampaigns(ex: Executor) {
  return toViews(ex, await q.listAllCampaigns(ex))
}

/** One campaign as the admin sees it, or 404. */
export async function getAdminCampaign(ex: Executor, id: string) {
  const row = await q.getCampaignRow(ex, id)
  if (!row) fail.notFound()
  const [view] = await toViews(ex, [row])
  if (!view) throw new Error("campaign vanished while it was read")
  return view
}

/**
 * Approves a campaign that waits for the admin (404 unknown, 409 `exists` in any other state).
 * The row is locked, so two admins pressing Approve together approve it once.
 */
export async function approveUnderReview(
  tx: Transaction,
  actor: Actor,
  id: string
) {
  await lockUndecided(tx, id)
  await approveCampaign(tx, id)
  await recordAudit(tx, actor, {
    action: "campaign.approve",
    targetType: "campaign",
    targetId: id,
    before: { status: "under_review" },
    after: { status: "approved" },
  })
}

/** Rejects a campaign that waits for the admin, with the reason the advertiser reads. 404 and 409 as for an approval. */
export async function rejectUnderReview(
  tx: Transaction,
  actor: Actor,
  rejection: { id: string; reason: string }
) {
  await lockUndecided(tx, rejection.id)
  await updateStatus(tx, {
    id: rejection.id,
    status: "rejected",
    rejectionReason: rejection.reason,
  })
  await recordAudit(tx, actor, {
    action: "campaign.reject",
    targetType: "campaign",
    targetId: rejection.id,
    before: { status: "under_review" },
    after: { status: "rejected" },
    reason: rejection.reason,
  })
}

/** Every page that sells space, switched off ones too, in list order; `free` is every slot (no dates). */
export async function listAdminAdPages(ex: Executor) {
  return (await q.listAdPages(ex)).map((row) => toAdPage(row, row.slots))
}

/** Changes the price, slots or sale switch of one page (404 for an unknown page). Running campaigns keep their slot. */
export async function updateAdPage(
  tx: Transaction,
  actor: Actor,
  change: { id: string; edit: AdPageEdit }
) {
  const known = adPageIdSchema.safeParse(change.id)
  if (!known.success) fail.notFound()
  const row = await q.lockAdPage(tx, known.data)
  if (!row) fail.notFound()
  const set = definedOnly(change.edit)
  if (Object.keys(set).length > 0) await q.updateAdPage(tx, { id: row.id, set })
  await recordAudit(tx, actor, {
    action: "ad_page.update",
    targetType: "ad_page",
    targetId: row.id,
    before: Object.fromEntries(
      Object.keys(set).map((key) => [key, row[key as keyof typeof row]])
    ),
    after: set,
  })
  const saved = { ...row, ...set }
  return toAdPage(saved, saved.slots)
}

async function lockUndecided(tx: Transaction, id: string) {
  const row = await lockCampaign(tx, id)
  if (!row) fail.notFound()
  if (row.status !== "under_review") fail.conflict("exists")
}

// A field left out of an edit stays as it is.
function definedOnly(edit: AdPageEdit) {
  return Object.fromEntries(
    Object.entries(edit).filter(([, value]) => value !== undefined)
  ) as AdPageEdit
}

// The advertiser is named as on their own campaigns (the English name), the picture is the uploaded banner.
async function toViews(
  ex: Executor,
  rows: Awaited<ReturnType<typeof q.listAllCampaigns>>
) {
  return Promise.all(
    rows.map(async (row) =>
      toCampaign(row, {
        ownerName: (await getOwnerNames(ex, row.ownerId)).en,
        imageUrl: (await uploads.uploadUrl(ex, row.imageUploadId)) ?? "",
      })
    )
  )
}
