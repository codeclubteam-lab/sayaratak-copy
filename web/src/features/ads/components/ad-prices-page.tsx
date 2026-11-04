import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/app/page-header"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import { adsQueries } from "../queries"
import { AdPriceRow } from "./ad-price-row"

export function AdPricesPage() {
  const { t } = useT()
  usePageTitle(t("dashboard.nav_ad_prices"))
  const pages = useQuery(adsQueries.adminPages)
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={t("dashboard.nav_ad_prices")}
        hint={t("ads.prices_hint")}
      />
      {pages.isError ? (
        <SectionError
          message={t("ads.pages_error")}
          onRetry={() => void pages.refetch()}
        />
      ) : !pages.data ? (
        <Skeleton className="h-64 rounded-xl" aria-hidden="true" />
      ) : (
        pages.data.map((p) => <AdPriceRow key={p.id} page={p} />)
      )}
    </div>
  )
}
