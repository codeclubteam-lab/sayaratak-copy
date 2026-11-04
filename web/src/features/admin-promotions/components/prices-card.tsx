import { useId, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { useT } from "@/lib/i18n/use-t"
import { promotionLabel } from "@/lib/promotion"
import type { PromotionPrice } from "@sayaratak/shared/schemas/billing"
import { adminQueries } from "@/features/admin/queries"
import { PriceText } from "@/components/app/price-text"
import { SectionError } from "@/components/app/section-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PriceDialog } from "./price-dialog"

// Every promotion price row: Featured for each length, and Bump up. The set is fixed; Edit changes the price, and the length of a Featured row.
export function PricesCard() {
  const { t } = useT()
  const id = useId()
  const prices = useQuery(adminQueries.promotionPrices)
  const [editing, setEditing] = useState<PromotionPrice>()
  if (prices.isError && !prices.data)
    return (
      <SectionError
        title={t("admin.promos_prices_title")}
        message={t("admin.promos_prices_error")}
        onRetry={() => void prices.refetch()}
      />
    )
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-title font-semibold">
          {t("admin.promos_prices_title")}
        </h2>
        <p className="text-ui text-muted-foreground">
          {t("admin.promos_prices_body")}
        </p>
      </div>
      {!prices.data ? (
        // One placeholder row per promotion type, shaped like the real row so nothing moves when the prices arrive.
        <ul aria-hidden="true" className="flex flex-col">
          {Array.from({ length: 4 }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-4 border-b py-3 last:border-b-0"
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-14 rounded-lg" />
            </li>
          ))}
        </ul>
      ) : (
        <ul
          aria-label={t("admin.promos_prices_table")}
          className="flex flex-col"
        >
          {prices.data.map((p) => {
            const name = promotionLabel(t, p)
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3 last:border-b-0"
              >
                <div className="flex min-w-32 flex-1 flex-col">
                  <span className="text-ui font-medium">
                    {t(`promotion.name_${p.type}`)}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {t(`promotion.effect_${p.type}`)}
                  </span>
                </div>
                <span className="text-ui text-muted-foreground">
                  {p.type === "bump"
                    ? t("promotion.once")
                    : t("billing.duration_days", { count: p.durationDays })}
                </span>
                <PriceText price={p.price} size="table" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label={t("admin.promos_price_edit", { name })}
                  onClick={() => setEditing(p)}
                >
                  {t("common.edit")}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <PriceDialog price={editing} onClose={() => setEditing(undefined)} />
    </section>
  )
}
