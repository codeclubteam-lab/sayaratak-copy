import type { ReactNode } from "react"

import { UsageMeter } from "@/components/app/usage-meter"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { cn } from "@/lib/utils"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import type { Role } from "@sayaratak/shared/schemas/fields"
import type { MeSubscription } from "@sayaratak/shared/schemas/responses"
import { PlanHeader } from "./plan-header"

const DAY_MS = 24 * 60 * 60 * 1000
const statusVariant = {
  active: "success",
  pending: "warning",
  expired: "destructive",
  canceled: "muted",
} as const

type Props = {
  data: MeSubscription
  // The subscription's plan, else the audience's free plan.
  plan?: Plan
  audience: Role
  // "sm" is the sidebar: smaller name, no credits.
  size?: "sm" | "md"
  // Makes the "Your plan" label the section's heading.
  headingId?: string
  // Sits at the end of the header row (the billing page puts the price there).
  end?: ReactNode
}

// The one "Your plan" summary of the sidebar, the overviews and billing: name and status, days left with a bar for the period, a payment in review, the usage meter (only with a cap) and the featured credits.
export function PlanSummary({
  data,
  plan,
  audience,
  size = "md",
  headingId,
  end,
}: Props) {
  const { t, locale } = useT()
  const now = useNow()
  const { subscription, usage, credits, reviewPlan } = data
  const ends = subscription ? Date.parse(subscription.endsAt) : null
  const days = ends === null ? null : Math.round((ends - now) / DAY_MS)
  const left =
    subscription && ends !== null
      ? Math.min(
          1,
          Math.max(0, (ends - now) / (ends - Date.parse(subscription.startsAt)))
        )
      : null
  return (
    <div className={cn("flex flex-col", size === "sm" ? "gap-3" : "gap-4")}>
      <PlanHeader
        name={plan?.name[locale]}
        size={size}
        headingId={headingId}
        end={end}
        badge={
          subscription && (
            <Badge variant={statusVariant[subscription.status]}>
              {t(`billing.status_${subscription.status}`)}
            </Badge>
          )
        }
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-ui text-muted-foreground">
          {/* The billing page also gives the date; the sidebar card keeps the short form. */}
          {size === "md" && subscription && days !== null && days > 0
            ? t("billing.ends_on", {
                date: formatDate(subscription.endsAt, locale),
                count: days,
              })
            : days === null
              ? t("billing.no_end")
              : days <= 0
                ? t("billing.ends_today")
                : t("billing.ends_in", { count: days })}
        </p>
        {/* The time left of the period; the line above says it in words. */}
        {left !== null && (
          <div
            aria-hidden="true"
            className="h-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-muted-foreground"
              style={{ width: `${left * 100}%` }}
            />
          </div>
        )}
      </div>
      {reviewPlan && (
        <p
          className={
            size === "sm"
              ? "text-caption text-muted-foreground"
              : "rounded-lg bg-muted px-4 py-3 text-ui"
          }
        >
          {reviewPlan.id === plan?.id
            ? t("billing.review_renewal")
            : t("billing.pending_notice", { name: reviewPlan.name[locale] })}
        </p>
      )}
      {usage.limit !== null && (
        <UsageMeter
          label={t(
            audience === "dealership"
              ? "billing.usage_vehicles"
              : "billing.usage_listings"
          )}
          used={usage.used}
          limit={usage.limit}
        />
      )}
      {size === "md" && credits.total > 0 && (
        <div className="flex flex-col gap-1">
          <p className="flex items-center justify-between gap-3 text-ui">
            <span>{t("billing.credits_label")}</span>
            <span className="font-medium num">
              {t("billing.credits_left", credits)}
            </span>
          </p>
          <p className="text-caption text-muted-foreground">
            {t("billing.credits_hint")}
          </p>
        </div>
      )}
    </div>
  )
}
