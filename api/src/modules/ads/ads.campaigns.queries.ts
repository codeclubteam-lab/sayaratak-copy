import type { AdPageId } from "@sayaratak/shared/schemas/ads"
import {
  and,
  arrayContains,
  desc,
  eq,
  gt,
  inArray,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm"

import type { Executor } from "~/shared/db/tx"

import { campaigns, type NewCampaignRow } from "./ads.tables"

// A campaign holds its slots from the moment its receipt is sent until it ends; an unpaid one holds none.
const HOLDING = ["under_review", "approved"] as const

export function insertCampaign(ex: Executor, row: NewCampaignRow) {
  return ex
    .insert(campaigns)
    .values(row)
    .returning()
    .then(([inserted]) => {
      // One row in, one row back; anything else is a driver fault.
      if (!inserted) throw new Error("insert into campaigns returned no row")
      return inserted
    })
}

/** The advertiser's campaigns, newest first. */
export function listCampaignsOf(ex: Executor, ownerId: string) {
  return ex
    .select()
    .from(campaigns)
    .where(eq(campaigns.ownerId, ownerId))
    .orderBy(desc(campaigns.createdAt), desc(campaigns.id))
}

/**
 * The pages of every campaign that holds slots in these dates, leaving out
 * `except` (the campaign being checked). Dates that only touch do not overlap.
 */
export function listHoldingPages(
  ex: Executor,
  of: { startsAt: Date; endsAt: Date; except?: string }
) {
  return ex
    .select({ pages: campaigns.pages })
    .from(campaigns)
    .where(
      and(
        inArray(campaigns.status, HOLDING),
        lt(campaigns.startsAt, of.endsAt),
        gt(campaigns.endsAt, of.startsAt),
        of.except ? ne(campaigns.id, of.except) : undefined
      )
    )
    .then((rows) => rows.map((row) => row.pages))
}

/** One approved campaign of the page that is running now, picked at random. */
export function pickRunning(ex: Executor, of: { page: AdPageId; now: Date }) {
  return (
    ex
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "approved"),
          arrayContains(campaigns.pages, [of.page]),
          lte(campaigns.startsAt, of.now),
          gt(campaigns.endsAt, of.now)
        )
      )
      // Raw `random()`: Drizzle has no helper; a handful of rows at most.
      .orderBy(sql`random()`)
      .limit(1)
      .then(([row]) => row)
  )
}
