import { useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import {
  planTabs,
  plansSearchSchema,
  type PlansSearch,
} from "@/features/admin/schemas"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { PageHeader } from "@/components/app/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IndividualSettingsCard } from "./individual-settings-card"
import { PlansTable } from "./plans-table"
import { SubscribersTable } from "./subscribers-table"

// Plans per audience and every subscription. The URL holds the tab, and on Subscribers its filters, search and page.
export function PlansPage() {
  const { t } = useT()
  const title = t("dashboard.nav_plans")
  usePageTitle(title)
  const search = plansSearchSchema.parse(useSearch({ strict: false }))
  const navigate = useNavigate()
  const { tab } = search
  const go = useCallback(
    (next: PlansSearch, push = false) =>
      void navigate({
        to: ".",
        search: next,
        replace: !push,
        resetScroll: false,
      }),
    [navigate]
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({ tab: plansSearchSchema.shape.tab.parse(next), page: 1 })
        }
      >
        <TabsList
          aria-label={t("admin.plans_tabs")}
          className="max-w-full overflow-x-auto"
        >
          {planTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`admin.plans_tab_${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-6">
          {tab === "subscribers" ? (
            <SubscribersTable search={search} go={go} />
          ) : (
            <>
              {tab === "user" && <IndividualSettingsCard />}
              <PlansTable audience={tab} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
