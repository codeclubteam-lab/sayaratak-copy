import { PriceText } from "@/components/app/price-text"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"
import { PromotionListing } from "./promotion-listing"
import { PromotionStatus } from "./promotion-status"

// One promotion as a card, for the promotions table below md.
export function PromotionCard({ promotion }: { promotion: MyPromotion }) {
  const { t, locale } = useT()
  const { startsAt, endsAt } = promotion
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <PromotionListing promotion={promotion} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="primary">{t(`promotion.name_${promotion.type}`)}</Badge>
        <span className="text-caption text-muted-foreground">
          {t(`billing.promos_source_${promotion.source}`)}
        </span>
      </div>
      {startsAt && endsAt && (
        <p className="text-caption text-muted-foreground">
          {t("billing.promos_runs", {
            start: formatDate(startsAt, locale),
            end: formatDate(endsAt, locale),
          })}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {promotion.price > 0 ? (
          <PriceText price={promotion.price} size="table" />
        ) : (
          <span className="text-ui">{t("billing.promos_free")}</span>
        )}
        <PromotionStatus promotion={promotion} />
      </div>
    </article>
  )
}
