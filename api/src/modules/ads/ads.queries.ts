import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import { asc, eq, inArray, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import { adPages, banners, campaigns } from "./ads.tables"

type Counter = "impressions" | "clicks"

/** Adds one to the banner's counter; false when there is no such banner. */
export async function bumpBanner(ex: Executor, id: string, counter: Counter) {
  const rows = await ex
    .update(banners)
    .set({ [counter]: sql`${banners[counter]} + 1` })
    .where(eq(banners.id, id))
    .returning({ id: banners.id })
  return rows.length > 0
}

/** Adds one to the campaign's counter; false when there is no such campaign. */
export async function bumpCampaign(ex: Executor, id: string, counter: Counter) {
  const rows = await ex
    .update(campaigns)
    .set({ [counter]: sql`${campaigns[counter]} + 1` })
    .where(eq(campaigns.id, id))
    .returning({ id: campaigns.id })
  return rows.length > 0
}

export function getCampaign(ex: Executor, id: string) {
  return ex
    .select({
      ownerId: campaigns.ownerId,
      status: campaigns.status,
      amount: campaigns.amount,
      weeks: campaigns.weeks,
      pages: campaigns.pages,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .then(([row]) => row)
}

/** Back to review after a new receipt: the old rejection reason no longer applies. */
export function updateUnderReview(ex: Executor, id: string) {
  return ex
    .update(campaigns)
    .set({ status: "under_review", rejectionReason: null })
    .where(eq(campaigns.id, id))
}

/** Every page that sells space, in list order. */
export function listPages(ex: Executor) {
  return ex.select().from(adPages).orderBy(asc(adPages.position))
}

/**
 * These pages, held until the transaction ends. FOR UPDATE: two campaigns
 * taking the last slot of a page queue here, so only one of them gets it.
 */
export function lockPages(tx: Transaction, ids: AdPageId[]) {
  return tx
    .select()
    .from(adPages)
    .where(inArray(adPages.id, ids))
    .orderBy(asc(adPages.id))
    .for("update")
}

/** The campaign, held until the transaction ends, so two decisions on its receipt queue up. */
export function lockCampaign(tx: Transaction, id: string) {
  return tx
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .for("update")
    .then(([row]) => row)
}

export function updateStatus(
  ex: Executor,
  change: {
    id: string
    status: "approved" | "rejected" | "pending_payment"
    rejectionReason: string | null
  }
) {
  return ex
    .update(campaigns)
    .set({
      status: change.status,
      rejectionReason: change.rejectionReason,
    })
    .where(eq(campaigns.id, change.id))
}

/** The campaigns with these ids: what a payment row names. */
export function listByIds(ex: Executor, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return ex
    .select({ id: campaigns.id, weeks: campaigns.weeks })
    .from(campaigns)
    .where(inArray(campaigns.id, ids))
}
