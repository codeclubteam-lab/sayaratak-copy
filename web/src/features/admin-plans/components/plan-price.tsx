import { useT } from "@/lib/i18n/use-t"
import { PriceText } from "@/components/app/price-text"

export function PlanPrice({ price }: { price: number }) {
  const { t } = useT()
  return price === 0 ? (
    <span className="text-ui font-semibold">{t("billing.promos_free")}</span>
  ) : (
    <PriceText price={price} size="table" />
  )
}
