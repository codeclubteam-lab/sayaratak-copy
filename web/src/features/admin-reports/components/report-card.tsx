import { formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminReport } from "@sayaratak/shared/schemas/admin"
import { ReasonBadge, ReportStatusBadge } from "./report-badges"
import { ReportListingCell } from "./report-listing-cell"

// One report below md: the listing button, then the reason, who and when.
export function ReportCard({
  report,
  onOpen,
}: {
  report: AdminReport
  onOpen: () => void
}) {
  const { t, locale } = useT()
  const now = useNow()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <ReportListingCell report={report} onOpen={onOpen} />
      <div className="flex flex-wrap items-center gap-2">
        <ReasonBadge reason={report.reason} />
        <ReportStatusBadge status={report.status} />
      </div>
      {report.listingReports > 1 && (
        <p className="text-caption">
          {t("admin.report_count", { count: report.listingReports })}
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        <bdi>{report.reporterName}</bdi>
        {" · "}
        {formatRelative(report.createdAt, now, locale)}
      </p>
    </article>
  )
}
