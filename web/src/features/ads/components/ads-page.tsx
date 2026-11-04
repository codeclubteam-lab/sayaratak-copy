import { useQuery } from "@tanstack/react-query"
import { PresentationIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { ShellLink } from "@/components/app/shell-link"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"
import { adsQueries } from "../queries"
import { CampaignCard } from "./campaign-card"

// The business's banner campaigns, newest first, and the way to start one.
export function AdsPage({ role }: { role: User["role"] }) {
  const { t } = useT()
  usePageTitle(t("dashboard.nav_ads"))
  const campaigns = useQuery(adsQueries.mine)
  const create = (
    <ShellLink
      path={`${dashboardPath(role)}/ads/new`}
      className={buttonVariants()}
    >
      {t("ads.new_campaign")}
    </ShellLink>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("dashboard.nav_ads")} hint={t("ads.page_hint")}>
        {campaigns.data?.length ? create : null}
      </PageHeader>
      {campaigns.isError ? (
        <SectionError
          message={t("ads.list_error")}
          onRetry={() => void campaigns.refetch()}
        />
      ) : !campaigns.data ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" aria-hidden="true" />
          ))}
        </div>
      ) : !campaigns.data.length ? (
        <EmptyState
          icon={PresentationIcon}
          title={t("ads.empty_title")}
          body={t("ads.empty_body")}
          action={create}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.data.map((c) => (
            <CampaignCard key={c.id} campaign={c} role={role} />
          ))}
        </div>
      )}
    </div>
  )
}
