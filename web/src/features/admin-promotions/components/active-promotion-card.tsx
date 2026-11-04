import { PromotionListing } from "@/features/billing/components/promotion-listing"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { MyPromotion } from "@sayaratak/shared/schemas/responses"
import { EndPromotionButton } from "./end-promotion-button"

// One active promotion below md.
export function ActivePromotionCard({ promotion }: { promotion: MyPromotion }) {
  const { t, locale } = useT()
  return (
    <article className="flex flex-col gap-2 border-b p-3 in-[li:last-child]:border-b-0">
      <PromotionListing promotion={promotion} />
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
        <Badge variant="primary">{t(`promotion.name_${promotion.type}`)}</Badge>
        <span>{t(`billing.promos_source_${promotion.source}`)}</span>
        {promotion.endsAt && (
          <span>
            {t("billing.promos_col_ends")}:{" "}
            {formatDate(promotion.endsAt, locale)}
          </span>
        )}
      </div>
      <EndPromotionButton promotion={promotion} />
    </article>
  )
}
