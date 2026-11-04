import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import { asc, desc, eq, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import { adPages, campaigns } from "./ads.tables"

/** Every campaign: the ones waiting for the admin first, then newest first; ties in the mock's id order (`camp-2` before `camp-10`). */
export function listAllCampaigns(ex: Executor) {
  return ex
    .select()
    .from(campaigns)
    .orderBy(
      asc(
        sql`case when ${campaigns.status} = 'under_review' then 0 else 1 end`
      ),
      desc(campaigns.createdAt),
      asc(sql`length(${campaigns.id})`),
      asc(campaigns.id)
    )
}

/** Every page that sells space, switched off ones too, in list order. */
export function listAdPages(ex: Executor) {
  return ex.select().from(adPages).orderBy(asc(adPages.position))
}

export function getCampaignRow(ex: Executor, id: string) {
  return ex
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .then(([row]) => row)
}

/** The page's price row, held until the transaction ends; a booking holds the same row, so a price change and a booking go one after the other. */
export function lockAdPage(tx: Transaction, id: AdPageId) {
  return tx
    .select()
    .from(adPages)
    .where(eq(adPages.id, id))
    .for("update")
    .then(([row]) => row)
}

export function updateAdPage(
  tx: Transaction,
  change: {
    id: AdPageId
    set: Partial<
      Pick<typeof adPages.$inferInsert, "weeklyPrice" | "slots" | "enabled">
    >
  }
) {
  return tx.update(adPages).set(change.set).where(eq(adPages.id, change.id))
}
