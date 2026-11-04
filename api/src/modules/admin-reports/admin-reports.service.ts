import type { AdminReport, Report } from "@sayaratak/shared/schemas/admin"
import type { reportActionInputSchema } from "@sayaratak/shared/schemas/inputs"
import type { z } from "zod"

import { db } from "~/shared/db/client"
import { type Executor, transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { both } from "~/shared/text/bilingual"
import type { Actor } from "~/modules/audit/audit.types"
import * as auth from "~/modules/auth/auth.service"
import * as users from "~/modules/auth/auth.users.service"
import * as listingsAdmin from "~/modules/listings/listings.admin.service"
import * as moderation from "~/modules/listings/listings.moderation.service"
import { getRowsByIds } from "~/modules/listings/listings.read.service"
import { toListings } from "~/modules/listings/listings.view.service"
import { notify } from "~/modules/notifications/notifications.service"
import * as reports from "~/modules/reports/reports.admin.service"
import { countReportsPerListing } from "~/modules/reports/reports.service"

type ActionInput = z.output<typeof reportActionInputSchema>

/** `GET /admin/reports`: reports newest first, each with its listing, reporter and seller state. */
export async function getAdminReports(
  actor: Actor,
  query: reports.ReportsQuery
) {
  const { reports: rows, ...page } = await reports.listAdminReports(
    db,
    query,
    await searchOf(query.q)
  )
  return { ...page, items: await toViews(db, actor, rows) }
}

/** `POST /admin/reports/:id/dismiss`: closes the report with the note; the report as it is after. */
export function dismiss(actor: Actor, change: { id: string; note?: string }) {
  return transaction(async (tx) => {
    await reports.lockOpenReport(tx, change.id)
    await reports.dismissReport(tx, actor, change)
    return viewOne(tx, actor, change.id)
  })
}

/**
 * `POST /admin/reports/:id/action`: removes the listing and tells its owner,
 * or with `ban` bans the owner and tells nobody. Every open report on the
 * listing closes with the note. A listing that cannot be removed (gone, a
 * draft, already removed) only has its reports closed.
 *
 * The ban goes first and has its own transaction (Better-Auth writes on its
 * own connection); if the report was closed meanwhile the answer is 409 and
 * the ban stands, as after any ban.
 */
export async function act(
  actor: Actor,
  change: { id: string; input: ActionInput; headers: Headers }
) {
  const { note, ban } = change.input
  if (ban) await banSeller(actor, { ...change, ban })
  return transaction(async (tx) => {
    const report = await reports.lockOpenReport(tx, change.id)
    const removed = ban
      ? undefined
      : await moderation.removeIfLive(tx, actor, report.listingId)
    if (removed?.ownerUserId)
      await notify(tx, {
        userId: removed.ownerUserId,
        type: "listing_rejected",
        title: { ar: "تمت إزالة إعلانك", en: "Your listing was removed" },
        body: both(removed.title),
      })
    await reports.actionReport(tx, actor, {
      report,
      note,
      outcome: outcomeOf(!!ban, !!removed),
    })
    return viewOne(tx, actor, change.id)
  })
}

function outcomeOf(banned: boolean, removed: boolean) {
  if (banned) return "banned"
  return removed ? "removed" : "none"
}

// 404 when the listing or its owner is gone, 403 for an admin.
async function banSeller(
  actor: Actor,
  change: { id: string; ban: NonNullable<ActionInput["ban"]>; headers: Headers }
) {
  const report = await reports.getReport(db, change.id)
  if (report.status !== "open") fail.conflict()
  const [listing] = await getRowsByIds(db, [report.listingId])
  if (!listing?.ownerUserId) fail.notFound()
  await users.banUser(actor, {
    userId: listing.ownerUserId,
    input: change.ban,
    headers: change.headers,
  })
}

// The text search reads the listing title and the reporter's name; each module finds its own ids.
async function searchOf(text: string | undefined) {
  const term = text?.trim().toLowerCase()
  if (!term) return undefined
  const [listingIds, reporterIds] = await Promise.all([
    listingsAdmin.listIdsTitled(db, term),
    auth.listIdsNamed(db, term),
  ])
  return { listingIds, reporterIds }
}

async function viewOne(ex: Executor, actor: Actor, id: string) {
  const { reports: rows } = await reports.listAdminReports(ex, { id })
  const [view] = await toViews(ex, actor, rows)
  if (!view) throw new Error("report vanished after a decision")
  return view
}

// Listing, seller, reporter and the report count per listing come from their own modules, in independent reads.
async function toViews(
  ex: Executor,
  actor: Actor,
  rows: Report[]
): Promise<AdminReport[]> {
  const listingIds = [...new Set(rows.map((row) => row.listingId))]
  const found = await getRowsByIds(ex, listingIds)
  const [listings, counts, people] = await Promise.all([
    toListings(ex, found, actor.admin),
    countReportsPerListing(ex, listingIds),
    auth.listUsers(ex, [
      ...rows.map((row) => row.reporterId),
      ...found.flatMap((row) => (row.ownerUserId ? [row.ownerUserId] : [])),
    ]),
  ])
  const listingOf = new Map(listings.map((listing) => [listing.id, listing]))
  const ownerOf = new Map(found.map((row) => [row.id, row.ownerUserId]))
  const personOf = new Map(people.map((person) => [person.id, person]))
  return rows.map((row) => {
    const seller = personOf.get(ownerOf.get(row.listingId) ?? "")
    return {
      ...row,
      listing: listingOf.get(row.listingId) ?? null,
      reporterName: personOf.get(row.reporterId)?.name ?? "",
      listingReports: counts.get(row.listingId) ?? 0,
      sellerBanned: !!seller && auth.isBannedNow(seller),
    }
  })
}
