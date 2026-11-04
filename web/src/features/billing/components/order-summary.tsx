import { useId } from "react"

import { PriceText } from "@/components/app/price-text"
import { useT } from "@/lib/i18n/use-t"
import type { Checkout } from "@sayaratak/shared/schemas/responses"

// What is being bought, in the reader's language. Everything comes from the checkout response.
export function OrderSummary({
  checkout,
  methodLabel,
}: {
  checkout: Checkout
  methodLabel: string
}) {
  const { t, locale } = useT()
  const heading = useId()
  return (
    <section
      aria-labelledby={heading}
      className="flex flex-col gap-3 rounded-xl bg-card p-5"
    >
      <h2 id={heading} className="text-title font-semibold">
        {t("billing.order_title")}
      </h2>
      <dl className="flex flex-col gap-2 text-ui">
        {(
          [
            [t("billing.order_item"), checkout.itemLabel[locale]],
            [
              t("billing.order_duration"),
              t("billing.duration_days", { count: checkout.durationDays }),
            ],
            [t("billing.order_method"), methodLabel],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-end font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t pt-3">
          <dt className="font-medium">{t("billing.order_total")}</dt>
          <dd>
            <PriceText price={checkout.amount} />
          </dd>
        </div>
      </dl>
    </section>
  )
}
