import { useId } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { SectionError } from "@/components/app/section-error"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { billingQueries } from "@/features/billing/queries"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import { PlanSummary } from "./plan-summary"

const billing = {
  dealership: "/$locale/dealer/billing",
  workshop: "/$locale/workshop/billing",
  mechanic: "/$locale/mechanic/billing",
} as const

// The shared plan summary and the way to billing, on the dealer, workshop and mechanic overviews. With no subscription it names the free plan of the role.
export function SubscriptionCard({
  role,
}: {
  role: "dealership" | "workshop" | "mechanic"
}) {
  const { t, locale } = useT()
  const id = useId()
  const subscription = useQuery(billingQueries.subscription)
  const plans = useQuery(billingQueries.plans(role))
  const data = subscription.data
  const plan = data?.plan ?? plans.data?.find((p) => p.price === 0)
  // An upgrade in review: a second payment is blocked, so the button opens the payment.
  const upgrading = !!data?.reviewPlan && data.reviewPlan.id !== plan?.id
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-5"
    >
      {subscription.isError ? (
        <>
          <h2 id={id} className="text-body font-semibold">
            {t("billing.current_title")}
          </h2>
          <SectionError
            message={t("billing.plans_error")}
            onRetry={() => void subscription.refetch()}
          />
        </>
      ) : !data ? (
        <>
          <h2 id={id} className="sr-only">
            {t("billing.current_title")}
          </h2>
          <Skeleton className="h-28" aria-hidden="true" />
        </>
      ) : (
        <>
          <PlanSummary data={data} plan={plan} audience={role} headingId={id} />
          <Link
            to={billing[role]}
            params={{ locale }}
            search={upgrading ? { tab: "history" } : undefined}
            // `cn` drops the base `border-transparent`, which would otherwise hide the outline border on a link.
            className={cn(
              buttonVariants({
                variant: plan?.price || upgrading ? "outline" : "default",
              }),
              "self-start"
            )}
          >
            {t(
              upgrading
                ? "billing.sidebar_view_payment"
                : plan?.price
                  ? "billing.sidebar_manage"
                  : "billing.sidebar_upgrade"
            )}
          </Link>
        </>
      )}
    </section>
  )
}
