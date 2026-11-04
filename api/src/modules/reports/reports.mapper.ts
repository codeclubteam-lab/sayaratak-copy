import type { Report } from "@sayaratak/shared/schemas/admin"

import type { reports } from "./reports.tables"

type ReportRow = typeof reports.$inferSelect

// A report outlives its deleted listing or reporter (the column goes null); the shared schema wants an id, so this one stands in (as for a review's deleted author). No listing or account has it.
const DELETED = "deleted"

/** A report as its reporter and the admin queue read it. */
export function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    listingId: row.listingId ?? DELETED,
    reporterId: row.reporterId ?? DELETED,
    reason: row.reason,
    details: row.details ?? undefined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolutionNote: row.resolutionNote ?? undefined,
  }
}
