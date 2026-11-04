import { useQuery } from "@tanstack/react-query"
import { PresentationIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import { adsQueries } from "../queries"
import { AdminCampaignRow } from "./admin-campaign-row"

// Every banner campaign, those waiting for review first.
export function AdminCampaignsPage() {
  const { t } = useT()
  usePageTitle(t("dashboard.nav_ad_campaigns"))
  const campaigns = useQuery(adsQueries.adminCampaigns)
  const waiting = campaigns.data?.filter(
    (c) => c.status === "under_review"
  ).length
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t("dashboard.nav_ad_campaigns")}
        hint={waiting ? t("ads.waiting", { count: waiting }) : undefined}
      />
      {campaigns.isError ? (
        <SectionError
          message={t("ads.list_error")}
          onRetry={() => void campaigns.refetch()}
        />
      ) : !campaigns.data ? (
        <Skeleton className="h-64 rounded-xl" aria-hidden="true" />
      ) : !campaigns.data.length ? (
        <EmptyState icon={PresentationIcon} title={t("ads.admin_empty")} />
      ) : (
        campaigns.data.map((c) => <AdminCampaignRow key={c.id} campaign={c} />)
      )}
    </div>
  )
}
