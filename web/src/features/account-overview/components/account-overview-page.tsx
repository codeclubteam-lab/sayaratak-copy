import { useQuery } from "@tanstack/react-query"
import { useSearch } from "@tanstack/react-router"

import { PageHeader } from "@/components/app/page-header"
import { meQuery } from "@/features/auth/me-query"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import { overviewSearchSchema } from "../schemas"
import { NeedsAttentionCard } from "./needs-attention-card"
import { OverviewStats } from "./overview-stats"
import { PerformanceCard } from "./performance-card"
import { PhoneVerifyNotice } from "./phone-verify-notice"
import { RecentActivity } from "./recent-activity"
import { WelcomeNotice } from "./welcome-notice"

// The first screen of the personal account: notices, four numbers, what needs doing, how the listings perform, and the latest notifications.
export function AccountOverviewPage() {
  const { t } = useT()
  const title = t("dashboard.nav_overview")
  usePageTitle(title)
  const { welcome } = overviewSearchSchema.parse(useSearch({ strict: false }))
  const me = useQuery(meQuery).data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      {welcome === 1 && <WelcomeNotice />}
      {import.meta.env.VITE_FEATURE_OTP === "true" &&
        me?.phone &&
        !me.verifiedPhone && <PhoneVerifyNotice phone={me.phone} />}
      <OverviewStats />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <NeedsAttentionCard />
        <PerformanceCard />
      </div>
      <RecentActivity />
    </div>
  )
}
