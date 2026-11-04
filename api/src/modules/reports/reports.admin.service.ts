import type { Executor, Transaction } from "~/shared/db/tx"
import { fail } from "~/shared/http/errors"
import { pageParams } from "~/shared/http/page"
import { recordAudit } from "~/modules/audit/audit.service"
import type { Actor } from "~/modules/audit/audit.types"

import * as admin from "./reports.admin.queries"
import { toReport } from "./reports.mapper"

const PAGE_SIZE = { default: 20, max: 100 }

/** Raw query values of `GET /admin/reports`, read as the mock reads them. */
export type ReportsQuery = Partial<
  Record<"status" | "id" | "q" | "page" | "pageSize" | "limit", string>
>

/** The ids a text search matches, found by the modules that own listings and accounts. */
export type ReportSearch = { listingIds: string[]; reporterIds: string[] }

/** One page of reports, newest first. */
export async function listAdminReports(
  ex: Executor,
  query: ReportsQuery,
  search?: ReportSearch
) {
  const { page, pageSize: size } = pageParams(query, PAGE_SIZE)
  const found = await admin.listForAdmin(ex, {
    id: query.id || undefined,
    status: query.status || undefined,
    search,
    page: { offset: (page - 1) * size, size },
  })
  return {
    reports: found.rows.map(toReport),
    total: found.total,
    page,
    pageSize: size,
  }
}

/** One report in any state, or 404. */
export async function getReport(ex: Executor, id: string) {
  const row = await admin.getById(ex, id)
  if (!row) fail.notFound()
  return toReport(row)
}

/**
 * The report, held until the transaction ends. 404 for an unknown one, 409
 * `conflict` once it is closed. Every report on its listing is locked first,
 * in id order, because an action closes them all: two admins deciding on two
 * reports of one listing then go one after the other instead of deadlocking.
 */
export async function lockOpenReport(tx: Transaction, id: string) {
  const seen = await admin.getById(tx, id)
  if (!seen) fail.notFound()
  if (seen.listingId) await admin.lockOfListing(tx, seen.listingId)
  const row = await admin.lockReport(tx, id)
  if (!row) fail.notFound()
  if (row.status !== "open") fail.conflict()
  return toReport(row)
}

/** Closes one open report as dismissed, with the admin's note. */
export async function dismissReport(
  tx: Transaction,
  actor: Actor,
  change: { id: string; note?: string }
) {
  await admin.decide(tx, {
    id: change.id,
    status: "dismissed",
    note: change.note,
  })
  await recordAudit(tx, actor, {
    action: "report.dismiss",
    targetType: "report",
    targetId: change.id,
    before: { status: "open" },
    after: { status: "dismissed" },
    reason: change.note,
  })
}

/**
 * Closes the report as actioned, and with it every other open report on the
 * same listing, all with the one note. `outcome` says what the admin did, for
 * the audit row.
 */
export async function actionReport(
  tx: Transaction,
  actor: Actor,
  change: {
    report: { id: string; listingId: string }
    note?: string
    outcome: "removed" | "banned" | "none"
  }
) {
  const { report } = change
  await admin.decide(tx, {
    id: report.id,
    status: "actioned",
    note: change.note,
  })
  const others = await admin.actionOpenOfListing(tx, {
    listingId: report.listingId,
    note: change.note,
  })
  await recordAudit(tx, actor, {
    action: "report.action",
    targetType: "report",
    targetId: report.id,
    before: { status: "open" },
    after: { status: "actioned", outcome: change.outcome, closed: others + 1 },
    reason: change.note,
  })
}
