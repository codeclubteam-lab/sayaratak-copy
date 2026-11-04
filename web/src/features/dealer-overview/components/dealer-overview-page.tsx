import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { DateRangeSelect } from "@/components/app/date-range-select"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { WelcomeNotice } from "@/features/account-overview/components/welcome-notice"
import { overviewSearchSchema } from "@/features/account-overview/schemas"
import { NeedsAttentionCard } from "@/features/account-overview/components/needs-attention-card"
import { analyticsQuery } from "@/features/analytics/queries"
import { analyticsSearchSchema } from "@/features/analytics/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { SetupChecklist } from "@/features/onboarding/components/setup-checklist"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import { DealerStats } from "./dealer-stats"
import { FunnelCard } from "./funnel-card"
import { SubscriptionCard } from "@/features/billing/components/subscription-card"
import { TopListingsCard } from "./top-listings-card"

// The first screen of a dealership: setup until done, five numbers, the contact funnel, the plan, the best listings and what needs doing. The period lives in the URL and drives every card that counts events.
export function DealerOverviewPage() {
  const { t } = useT()
  const title = t("dashboard.nav_overview")
  usePageTitle(title)
  const search = useSearch({ strict: false })
  const { range } = analyticsSearchSchema.parse(search)
  const { welcome } = overviewSearchSchema.parse(search)
  const navigate = useNavigate()
  const analytics = useQuery(analyticsQuery(range))
  const setRange = (next: Range) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        range: next === "30d" ? undefined : next,
      }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title}>
        <DateRangeSelect value={range} onChange={setRange} />
      </PageHeader>
      {welcome === 1 && <WelcomeNotice role="dealership" />}
      <SetupChecklist />
      <DealerStats range={range} analytics={analytics} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {analytics.isError ? (
          <SectionError
            message={t("analytics.load_error")}
            onRetry={() => void analytics.refetch()}
          />
        ) : (
          <FunnelCard range={range} data={analytics.data} />
        )}
        <SubscriptionCard role="dealership" />
      </div>
      {!analytics.isError && (
        <TopListingsCard range={range} data={analytics.data} />
      )}
      <NeedsAttentionCard withPending />
    </div>
  )
}
