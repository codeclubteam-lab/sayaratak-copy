import { useQuery } from "@tanstack/react-query"
import { Link, type LinkProps } from "@tanstack/react-router"
import { ChevronRightIcon } from "lucide-react"

import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { countsQuery } from "@/features/notifications/counts-query"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"

// The four queues that wait on the admin (each screen opens on its waiting tab by default), with the same counts as the sidebar badges.
export function QueuesCard() {
  const { t, locale } = useT()
  const counts = useQuery(countsQuery)
  const params = { locale }
  const rows: { label: string; count?: number; link: LinkProps }[] = [
    {
      label: t("admin.queue_listings"),
      count: counts.data?.pendingListings,
      link: { to: "/$locale/admin/moderation", params },
    },
    {
      label: t("admin.queue_reports"),
      count: counts.data?.openReports,
      link: { to: "/$locale/admin/reports", params },
    },
    {
      label: t("admin.queue_verifications"),
      count: counts.data?.pendingVerifications,
      link: { to: "/$locale/admin/verifications", params },
    },
    {
      label: t("admin.queue_payments"),
      count: counts.data?.pendingPayments,
      link: { to: "/$locale/admin/payments", params },
    },
  ]
  return (
    <section
      aria-labelledby="admin-queues"
      className="flex flex-col gap-2 rounded-xl bg-card p-5"
    >
      <h2 id="admin-queues" className="text-body font-semibold">
        {t("admin.queues_title")}
      </h2>
      {counts.isError ? (
        <SectionError
          message={t("admin.queues_error")}
          onRetry={() => void counts.refetch()}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <li key={row.label}>
              <Link
                {...row.link}
                className="flex min-h-12 items-center gap-3 rounded-lg px-2 motion-color hover:bg-muted"
              >
                <span className="flex-1 text-ui">{row.label}</span>
                {row.count === undefined ? (
                  <Skeleton className="h-5 w-8" aria-hidden="true" />
                ) : (
                  <span className="text-ui font-semibold num">
                    {formatNumber(row.count, locale)}
                  </span>
                )}
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground rtl:-scale-x-100"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
