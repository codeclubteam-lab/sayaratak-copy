import { useLocation, useNavigate, useSearch } from "@tanstack/react-router"

import { PageHeader } from "@/components/app/page-header"
import { resultsHeadingId } from "@/components/app/results-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import {
  billingSearchSchema,
  pruneBillingSearch,
  type BillingSearch,
} from "../schemas"
import { PaymentHistoryTable } from "./payment-history-table"
import { PlanTab } from "./plan-tab"

// Plan and payment history for every dashboard but the admin's. The tab and the history page live in the URL.
export function BillingPage({ audience }: { audience: Plan["audience"] }) {
  const { t, locale } = useT()
  const search = billingSearchSchema.parse(useSearch({ strict: false }))
  const pathname = useLocation({ select: (l) => l.pathname })
  const navigate = useNavigate()
  const title = t("dashboard.nav_billing")
  usePageTitle(title)
  const go = (next: Partial<BillingSearch>, replace: boolean) =>
    void navigate({
      to: ".",
      search: pruneBillingSearch({ ...search, ...next }),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  const hrefFor = (page: number) => {
    const query = new URLSearchParams(
      Object.entries(pruneBillingSearch({ tab: "history", page })).map(
        ([k, v]) => [k, String(v)]
      )
    ).toString()
    return localeHref(`${pathname}?${query}`, locale)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} headingId={resultsHeadingId} />
      <Tabs
        value={search.tab}
        onValueChange={(next) =>
          go({ tab: next === "history" ? "history" : "plan", page: 1 }, true)
        }
      >
        <TabsList aria-label={t("billing.tabs_label")}>
          <TabsTrigger value="plan">{t("billing.tab_plan")}</TabsTrigger>
          <TabsTrigger value="history">{t("billing.tab_history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="plan">
          <PlanTab
            audience={audience}
            onHistory={() => go({ tab: "history", page: 1 }, false)}
          />
        </TabsContent>
        <TabsContent value="history">
          <PaymentHistoryTable
            page={search.page}
            hrefFor={hrefFor}
            onPageChange={(page) => go({ page }, false)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
