import { useQuery } from "@tanstack/react-query"

import { PriceText } from "@/components/app/price-text"
import { PromotedBadge } from "@/components/app/promoted-badge"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n/use-t"
import { billingQueries } from "../queries"

// Each promotion price row with what it does, how long it runs and its price. Read only; buying starts from "Promote a listing".
export function PromotionPriceCards() {
  const { t } = useT()
  const prices = useQuery(billingQueries.promotionPrices)
  if (prices.isError)
    return (
      <SectionError
        message={t("billing.prices_error")}
        onRetry={() => void prices.refetch()}
      />
    )
  return (
    <ul
      aria-label={t("billing.promos_prices_label")}
      aria-busy={!prices.data}
      className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4"
    >
      {!prices.data
        ? [0, 1, 2, 3].map((i) => (
            <li key={i} aria-hidden="true">
              <Skeleton className="h-36 rounded-xl" />
            </li>
          ))
        : prices.data.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-ui font-semibold">
                  {t(`promotion.name_${p.type}`)}
                </h2>
                {p.type === "featured" && <PromotedBadge />}
              </div>
              <p className="flex-1 text-caption text-muted-foreground">
                {t(`promotion.effect_${p.type}`)}
              </p>
              <div className="flex items-end justify-between gap-2">
                <PriceText price={p.price} size="table" />
                <span className="text-caption text-muted-foreground">
                  {p.type === "bump"
                    ? t("promotion.once")
                    : t("billing.duration_days", { count: p.durationDays })}
                </span>
              </div>
            </li>
          ))}
    </ul>
  )
}
