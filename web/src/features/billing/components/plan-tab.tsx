import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { CreditCardIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PlansGrid } from "@/components/app/plans-grid"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import { billingQueries } from "../queries"
import { CurrentPlanCard } from "./current-plan-card"
import { PAYMENTS_PAGE_SIZE } from "./payment-history-table"

// The current plan (its summary also names a payment under review), then every plan the audience can buy. Choosing one opens its checkout; a plan with a payment under review shows a disabled button and cannot be paid twice.
export function PlanTab({
  audience,
  onHistory,
}: {
  audience: Plan["audience"]
  onHistory: () => void
}) {
  const { t, locale } = useT()
  const router = useRouter()
  const plans = useQuery(billingQueries.plans(audience))
  const subscription = useQuery(billingQueries.subscription)
  // The same page the history tab shows, so one request serves both.
  const payments = useQuery(
    billingQueries.payments({ page: 1, pageSize: PAYMENTS_PAGE_SIZE })
  )
  if (plans.isError || subscription.isError)
    return (
      <SectionError
        message={t("billing.plans_error")}
        onRetry={() => {
          void plans.refetch()
          void subscription.refetch()
        }}
      />
    )
  if (!plans.data || !subscription.data)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-40 rounded-xl" aria-hidden="true" />
        <Skeleton className="h-64 rounded-xl" aria-hidden="true" />
      </div>
    )
  if (!plans.data.length)
    return (
      <EmptyState
        icon={CreditCardIcon}
        title={t("billing.plans_empty_title")}
        body={t("billing.plans_empty_body")}
      />
    )
  const free = plans.data.find((p) => p.price === 0)
  const pendingIds = new Set(
    payments.data?.items
      .filter((p) => p.itemType === "plan" && p.status === "pending_review")
      .map((p) => p.itemId)
  )
  const choose = (id: string) =>
    router.history.push(
      localeHref(
        `${dashboardPath(audience)}/billing/checkout?${new URLSearchParams({ item: `plan:${id}` })}`,
        locale
      )
    )
  return (
    <div className="flex flex-col gap-6">
      <CurrentPlanCard
        data={subscription.data}
        freePlan={free}
        audience={audience}
        onHistory={onHistory}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-title font-semibold">{t("billing.plans_title")}</h2>
        <PlansGrid
          mode="action"
          plans={plans.data}
          currentId={(subscription.data.plan ?? free)?.id}
          onAction={choose}
          pendingIds={[...pendingIds]}
        />
      </section>
    </div>
  )
}
