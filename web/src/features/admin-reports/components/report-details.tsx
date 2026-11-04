import type { ReactNode } from "react"

import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { AdminReport } from "@sayaratak/shared/schemas/admin"
import { SellerPanel } from "@/features/admin/components/seller-panel"
import { ListingPreview } from "@/components/app/listing-preview"
import { StatusBadge } from "@/components/app/status-badge"
import { ReasonBadge, ReportStatusBadge } from "./report-badges"

// The body of the report sheet: the facts, both notes, the listing and its seller.
export function ReportDetails({ report }: { report: AdminReport }) {
  const { t, locale } = useT()
  const { listing } = report
  const fact = (label: string, value: ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-ui">{value}</dd>
    </div>
  )
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4">
        {fact(t("admin.reason"), <ReasonBadge reason={report.reason} />)}
        {fact(
          t("admin.report_col_status"),
          <ReportStatusBadge status={report.status} />
        )}
        {fact(t("admin.report_col_reporter"), <bdi>{report.reporterName}</bdi>)}
        {fact(t("admin.report_col_date"), formatDate(report.createdAt, locale))}
        {fact(
          t("admin.report_col_count"),
          <span className="num">
            {formatNumber(report.listingReports, locale)}
          </span>
        )}
      </dl>
      <section className="flex flex-col gap-1">
        <h3 className="text-ui font-semibold">{t("admin.report_note")}</h3>
        <p className="text-body whitespace-pre-line">
          {report.details ?? t("admin.report_no_note")}
        </p>
      </section>
      {report.resolutionNote && (
        <section className="flex flex-col gap-1">
          <h3 className="text-ui font-semibold">
            {t("admin.report_resolution")}
          </h3>
          <p className="text-body whitespace-pre-line">
            {report.resolutionNote}
          </p>
        </section>
      )}
      {listing ? (
        <>
          <section className="flex flex-col gap-3">
            <ListingPreview listing={listing} compact />
            <div className="flex flex-wrap items-center gap-3">
              {listing.moderation !== "approved" && (
                <StatusBadge status={listing.moderation} />
              )}
              <a
                href={localeHref(`/admin/listings?id=${listing.id}`, locale)}
                className="text-ui font-medium text-primary hover:underline"
              >
                {t("admin.open_in_listings")}
              </a>
            </div>
          </section>
          <SellerPanel owner={listing.owner} className="rounded-none p-0" />
          {report.sellerBanned && (
            <p className="text-ui text-destructive">
              {t("admin.seller_is_banned")}
            </p>
          )}
        </>
      ) : (
        <p className="text-body text-muted-foreground">
          {t("admin.report_listing_gone")}
        </p>
      )}
    </div>
  )
}
