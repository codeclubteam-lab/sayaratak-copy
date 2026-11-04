import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { AreaChartCard } from "@/components/app/area-chart-card"
import { BarChartCard } from "@/components/app/bar-chart-card"
import { DateRangeSelect } from "@/components/app/date-range-select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { listingQueries } from "@/features/listings/queries"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// Views, contacts and totals of one listing, for a period.
export function ListingAnalyticsSheet({
  listing,
  onClose,
}: {
  listing: Listing
  onClose: () => void
}) {
  const { t, locale } = useT()
  const [range, setRange] = useState<Range>("30d")
  const { data, isPending, isError, refetch } = useQuery(
    listingQueries.analytics(listing.id, range)
  )
  const totals = data?.totals
  const chart = {
    loading: isPending,
    error: isError,
    onRetry: () => void refetch(),
  }
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-4 overflow-y-auto p-6 sm:max-w-xl">
        <SheetHeader className="p-0">
          <SheetTitle>{t("manager.analytics_title")}</SheetTitle>
          <p className="truncate text-ui text-muted-foreground">
            <bdi>{listing.title}</bdi>
          </p>
        </SheetHeader>
        <DateRangeSelect value={range} onChange={setRange} />
        <AreaChartCard
          title={t("manager.chart_views")}
          series={[{ key: "views", label: t("manager.col_views") }]}
          data={data?.series}
          {...chart}
        />
        <BarChartCard
          title={t("manager.chart_contacts")}
          series={[
            { key: "phoneClicks", label: t("manager.metric_calls") },
            { key: "whatsappClicks", label: t("manager.metric_whatsapp") },
          ]}
          data={data?.series}
          {...chart}
        />
        {totals && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["manager.col_views", totals.views],
                ["manager.col_favorites", totals.favorites],
                ["manager.metric_calls", totals.phoneClicks],
                ["manager.metric_whatsapp", totals.whatsappClicks],
                ["manager.metric_shares", totals.shares],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-caption text-muted-foreground">
                  {t(label)}
                </dt>
                <dd className="text-title font-semibold num">
                  {formatNumber(value, locale)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}
