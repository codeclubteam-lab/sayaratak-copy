import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm"

import type { Executor, Transaction } from "~/shared/db/tx"

import { reports } from "./reports.tables"

/** The admin queue's filters as the mock reads them; unset means no filter. */
export type AdminReportFilters = {
  id?: string
  /** `open`, `dismissed`, `actioned`, or `resolved` for the last two together. */
  status?: string
  /** Listings whose title and accounts whose name hold the text. */
  search?: { listingIds: string[]; reporterIds: string[] }
  page: { offset: number; size: number }
}

/** One page of reports with the total, newest first, ties in the mock's id order (`rp-2` before `rp-10`). */
export async function listForAdmin(ex: Executor, find: AdminReportFilters) {
  const where = and(
    find.id ? eq(reports.id, find.id) : undefined,
    statusWhere(find.status),
    find.search
      ? or(
          inArray(reports.listingId, [...find.search.listingIds, ""]),
          inArray(reports.reporterId, [...find.search.reporterIds, ""])
        )
      : undefined
  )
  const rows = await ex
    .select({
      report: reports,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(reports)
    .where(where)
    .orderBy(
      desc(reports.createdAt),
      asc(sql`length(${reports.id})`),
      asc(reports.id)
    )
    .offset(find.page.offset)
    .limit(find.page.size)
  const total = rows[0]?.total ?? (await ex.$count(reports, where))
  return { rows: rows.map((row) => row.report), total }
}

export function getById(ex: Executor, id: string) {
  return ex
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .then(([row]) => row)
}

/** The report, held until the transaction ends: two admins deciding on it go one after the other. */
export function lockReport(tx: Transaction, id: string) {
  return tx
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .for("update")
    .then(([row]) => row)
}

/** Every report on the listing, held in id order until the transaction ends. */
export function lockOfListing(tx: Transaction, listingId: string) {
  return tx
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.listingId, listingId))
    .orderBy(asc(reports.id))
    .for("update")
}

/** Sets the state and note of one report. */
export function decide(
  tx: Transaction,
  find: {
    id: string
    status: "dismissed" | "actioned"
    note: string | undefined
  }
) {
  return tx
    .update(reports)
    .set({ status: find.status, resolutionNote: find.note ?? null })
    .where(eq(reports.id, find.id))
}

/** Closes every open report on the listing as actioned, with the same note. Returns how many closed. */
export async function actionOpenOfListing(
  tx: Transaction,
  find: { listingId: string; note: string | undefined }
) {
  const closed = await tx
    .update(reports)
    .set({ status: "actioned", resolutionNote: find.note ?? null })
    .where(
      and(eq(reports.listingId, find.listingId), eq(reports.status, "open"))
    )
    .returning({ id: reports.id })
  return closed.length
}

// `resolved` is every state but open; a value outside the enum matches nothing instead of failing the cast.
function statusWhere(status: string | undefined) {
  if (!status) return undefined
  if (status === "resolved") return ne(reports.status, "open")
  return sql`${reports.status}::text = ${status}`
}
