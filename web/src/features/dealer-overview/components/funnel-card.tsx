import { useId } from "react"
import { Link } from "@tanstack/react-router"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

// Whole percent of the step before; nothing when the step before is 0.
const rate = (count: number, before: number) =>
  before ? Math.round((count / before) * 100) : undefined

// Views, then contacts (calls and WhatsApp), then messages. Bars are sized against views and never animate.
export function FunnelCard({
  range,
  data,
}: {
  range: Range
  data?: Analytics
}) {
  const { t, locale } = useT()
  const id = useId()
  const totals = data?.totals
  const steps = totals && [
    { key: "views", label: t("analytics.series_views"), count: totals.views },
    {
      key: "contacts",
      label: t("analytics.col_contacts"),
      count: totals.calls + totals.whatsapp,
      of: "dashboard.dealer_funnel_of_views",
    },
    {
      key: "messages",
      label: t("analytics.series_messages"),
      count: totals.messages,
      of: "dashboard.dealer_funnel_of_contacts",
    },
  ]
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-body font-semibold">
          {t("dashboard.dealer_funnel_title")}
        </h2>
        <Link
          to="/$locale/dealer/analytics"
          params={{ locale }}
          search={{ range }}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("dashboard.dealer_see_analytics")}
        </Link>
      </div>
      {!steps ? (
        <Skeleton className="h-40" aria-hidden="true" />
      ) : (
        <ol className="flex flex-col gap-4">
          {steps.map((step, i) => {
            const before = steps[i - 1]?.count ?? 0
            const percent = rate(step.count, before)
            return (
              <li key={step.key} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-ui">
                  <span>{step.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold num">
                      {formatNumber(step.count, locale)}
                    </span>
                    {step.of && percent !== undefined && (
                      <span className="text-caption text-muted-foreground num">
                        {t(step.of, {
                          rate: `⁦${formatNumber(percent, locale)}%⁩`,
                        })}
                      </span>
                    )}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-3 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${totals.views ? Math.min(100, (step.count / totals.views) * 100) : 0}%`,
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
