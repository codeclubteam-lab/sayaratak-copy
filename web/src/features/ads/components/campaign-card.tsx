import { PriceText } from "@/components/app/price-text"
import { ShellLink } from "@/components/app/shell-link"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import { dashboardPath } from "@/lib/navigation"
import type { Campaign } from "@sayaratak/shared/schemas/ads"
import type { User } from "@sayaratak/shared/schemas/user"
import { campaignState, stateVariant } from "../campaign-state"

// One campaign: its banner photo and heading, state, pages, dates, price and results. An unpaid one links to its checkout.
export function CampaignCard({
  campaign: c,
  role,
}: {
  campaign: Campaign
  role: User["role"]
}) {
  const { t, locale } = useT()
  const state = campaignState(c, useNow())
  const ctr = c.impressions ? (c.clicks / c.impressions) * 100 : 0
  const checkout = `${dashboardPath(role)}/billing/checkout?${new URLSearchParams({ item: `campaign:${c.id}` })}`
  return (
    <article className="flex flex-col gap-4 rounded-xl bg-card p-5 md:flex-row">
      <img
        src={c.creative.imageUrl}
        width={640}
        height={480}
        alt=""
        loading="lazy"
        className="aspect-[4/3] w-full rounded-lg bg-muted object-cover md:w-40"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-ui font-semibold">
            {c.creative.copy[locale].heading}
          </h2>
          <Badge variant={stateVariant[state]}>{t(`ads.state_${state}`)}</Badge>
        </div>
        <p className="text-caption text-muted-foreground">
          {c.pages.map((p) => t(`ads.page_${p}`)).join(" · ")}
        </p>
        <p className="text-ui text-muted-foreground">
          {formatDate(c.startsAt, locale)} – {formatDate(c.endsAt, locale)}
        </p>
        {state === "rejected" && c.rejectionReason && (
          <p className="text-ui text-destructive">
            {t("ads.rejected_because", { reason: c.rejectionReason })}
          </p>
        )}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-ui">
          <div className="flex gap-1">
            <dt className="text-muted-foreground">{t("ads.views")}</dt>
            <dd className="num">{formatNumber(c.impressions, locale)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted-foreground">{t("ads.clicks")}</dt>
            <dd className="num">{formatNumber(c.clicks, locale)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-muted-foreground">{t("ads.ctr")}</dt>
            <dd className="num">{ctr.toFixed(1)}%</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col items-start gap-3 md:items-end">
        <PriceText price={c.amount} size="table" />
        {state === "pending_payment" && (
          <ShellLink path={checkout} className={buttonVariants()}>
            {t("ads.pay_now")}
          </ShellLink>
        )}
      </div>
    </article>
  )
}
