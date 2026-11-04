import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { User } from "@sayaratak/shared/schemas/user"
import { billingQueries } from "../queries"
import { PlanHeader } from "./plan-header"
import { PlanSummary } from "./plan-summary"

// The plan at the foot of the dashboard sidebar: a plan picked in onboarding and not paid, else the shared summary of the current plan (a payment in review shows as a note in it, and an upgrade in review links to the payment). Hidden while the sidebar is collapsed; Billing is right above it.
export function SidebarPlanCard({ me }: { me: User }) {
  const { t, locale } = useT()
  const subscription = useQuery(billingQueries.subscription)
  const plans = useQuery(billingQueries.plans(me.role))
  const data = subscription.data
  if (!data || !plans.data) return null
  const base = dashboardPath(me.role)
  const current = data.plan ?? plans.data.find((p) => p.price === 0)
  const chosen = data.reviewPlan
    ? undefined
    : plans.data.find((p) => p.id === me.chosenPlanId)
  const upgrading = !!data.reviewPlan && data.reviewPlan.id !== current?.id

  const link = (href: string, label: string, primary: boolean) => (
    <a
      href={localeHref(href, locale)}
      className={cn(
        buttonVariants({ variant: primary ? "default" : "outline" }),
        "w-full"
      )}
    >
      {label}
    </a>
  )
  const card =
    "mx-2 mb-6 flex flex-col gap-4 rounded-xl bg-card p-4 group-data-[collapsible=icon]:hidden"

  if (chosen)
    return (
      <div className={card}>
        <PlanHeader
          name={chosen.name[locale]}
          size="sm"
          badge={<Badge variant="warning">{t("billing.sidebar_unpaid")}</Badge>}
        />
        <p className="text-ui text-muted-foreground">
          {t("billing.sidebar_unpaid_note", {
            free: current?.name[locale] ?? "",
          })}
        </p>
        {link(
          `${base}/billing/checkout?${new URLSearchParams({ item: `plan:${chosen.id}` })}`,
          t("billing.promos_pay_now"),
          true
        )}
      </div>
    )

  return (
    // A plain block, not a region: the overview page has its own "Your plan" section.
    <div className={card}>
      <PlanSummary data={data} plan={current} audience={me.role} size="sm" />
      {upgrading
        ? link(
            `${base}/billing?tab=history`,
            t("billing.sidebar_view_payment"),
            false
          )
        : link(
            `${base}/billing`,
            t(
              current?.price
                ? "billing.sidebar_manage"
                : "billing.sidebar_upgrade"
            ),
            !current?.price
          )}
    </div>
  )
}
