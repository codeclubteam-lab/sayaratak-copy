import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { PromotionChoiceForm } from "@/features/billing/components/promotion-choice-form"
import { billingQueries } from "@/features/billing/queries"
import { useT } from "@/lib/i18n/use-t"
import type { User } from "@sayaratak/shared/schemas/user"

// "Get more views": the paid promotions of an approved listing. Continue creates the unpaid promotion and opens its checkout in the owner's dashboard; Not now closes the offer and creates nothing. Nothing shows while the prices load, fail or are empty: the offer is an extra, not part of the result.
export function PromotionOffer({
  listingId,
  role,
  onSkip,
}: {
  listingId: string
  role: User["role"]
  onSkip: () => void
}) {
  const { t } = useT()
  const prices = useQuery(billingQueries.promotionPrices)
  if (!prices.data?.length) return null
  return (
    <div className="flex flex-col gap-4 pt-2">
      <h2 className="text-title font-semibold">{t("post.promo_title")}</h2>
      <PromotionChoiceForm
        listingId={listingId}
        role={role}
        prices={prices.data}
        label={t("post.promo_title")}
        secondary={
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t("post.promo_skip")}
          </Button>
        }
      />
    </div>
  )
}
