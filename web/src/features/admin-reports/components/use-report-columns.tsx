import type { DataColumn } from "@/lib/table"
import { formatNumber, formatRelative } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { AdminReport } from "@sayaratak/shared/schemas/admin"
import { ReasonBadge, ReportStatusBadge } from "./report-badges"
import { ReportListingCell } from "./report-listing-cell"

// Columns of the reports table. The server keeps them newest first, so no column sorts.
export function useReportColumns(
  onOpen: (report: AdminReport) => void
): DataColumn<AdminReport>[] {
  const { t, locale } = useT()
  const now = useNow()
  return [
    {
      id: "listing",
      header: t("admin.report_col_listing"),
      enableHiding: false,
      cell: ({ row }) => (
        <ReportListingCell
          report={row.original}
          onOpen={() => onOpen(row.original)}
        />
      ),
    },
    {
      id: "reason",
      header: t("admin.reason"),
      cell: ({ row }) => <ReasonBadge reason={row.original.reason} />,
    },
    {
      id: "count",
      header: t("admin.report_col_count"),
      cell: ({ row }) => (
        <span className="num">
          {formatNumber(row.original.listingReports, locale)}
        </span>
      ),
    },
    {
      id: "reporter",
      header: t("admin.report_col_reporter"),
      cell: ({ row }) => <bdi>{row.original.reporterName}</bdi>,
    },
    {
      id: "date",
      header: t("admin.report_col_date"),
      cell: ({ row }) => formatRelative(row.original.createdAt, now, locale),
    },
    {
      id: "status",
      header: t("admin.report_col_status"),
      cell: ({ row }) => <ReportStatusBadge status={row.original.status} />,
    },
  ]
}
