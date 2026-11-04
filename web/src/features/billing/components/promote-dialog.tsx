import { useQuery } from "@tanstack/react-query"
import { MegaphoneIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { ResponsiveDialog } from "@/components/app/responsive-dialog"
import { SectionError } from "@/components/app/section-error"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import { billingQueries } from "../queries"
import { CreditOffer } from "./credit-offer"
import { PromotionChoiceForm } from "./promotion-choice-form"

// Promote one listing (never a bulk action): pick a promotion, then pay for it at the checkout.
export function PromoteDialog({
  listingId,
  onClose,
}: {
  listingId: string
  onClose: () => void
}) {
  const { t } = useT()
  const me = useQuery(meQuery).data
  const prices = useQuery(billingQueries.promotionPrices)
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("billing.promote_title")}
    >
      {prices.isError ? (
        <SectionError
          message={t("billing.prices_error")}
          onRetry={() => void prices.refetch()}
        />
      ) : !prices.data ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" aria-hidden="true" />
          ))}
        </div>
      ) : !prices.data.length ? (
        <EmptyState
          icon={MegaphoneIcon}
          title={t("billing.prices_empty")}
          level={3}
          className="py-6"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <CreditOffer listingId={listingId} onDone={onClose} />
          <PromotionChoiceForm
            listingId={listingId}
            role={me?.role ?? "user"}
            prices={prices.data}
            label={t("billing.promote_title")}
            secondary={
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            }
          />
        </div>
      )}
    </ResponsiveDialog>
  )
}
