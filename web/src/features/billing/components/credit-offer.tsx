import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { billingQueries, useCreatePromotion } from "../queries"

// Shown in Promote while the plan still has featured credits: one tap features the listing for 7 days, no checkout.
export function CreditOffer({
  listingId,
  onDone,
}: {
  listingId: string
  onDone: () => void
}) {
  const { t } = useT()
  const credits = useQuery(billingQueries.subscription).data?.credits
  const create = useCreatePromotion()
  if (!credits?.left) return null
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
      <div className="flex flex-col gap-1">
        <p className="text-ui font-semibold">
          {t("billing.credit_offer_title")}
        </p>
        <p className="text-ui text-muted-foreground">
          {t("billing.credit_offer_body", credits)}
        </p>
      </div>
      <Button
        type="button"
        variant="signal"
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate(
            { listingId, useCredit: true },
            {
              onSuccess: () => {
                toast.add({ title: t("billing.credit_used") })
                onDone()
              },
              onError: (e) => toast.add({ title: errorText(t, e) }),
            }
          )
        }
      >
        {t("billing.use_credit")}
      </Button>
      <p className="text-caption text-muted-foreground">
        {t("billing.or_pay")}
      </p>
    </div>
  )
}
