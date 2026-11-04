import type { TFunction } from "i18next"

import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { AdminPayment } from "@sayaratak/shared/schemas/responses"

// What the payment buys, in one line: "Plus plan", "Boost: <listing>", "Banner campaign".
export function paymentItem(t: TFunction, p: AdminPayment, locale: Locale) {
  const label = p.itemLabel[locale]
  if (p.itemType === "plan") return t("admin.payment_item_plan", { label })
  if (p.itemType === "campaign") return label
  return p.order.promotionType
    ? t("admin.payment_item_promotion", {
        type: t(`promotion.name_${p.order.promotionType}`),
        label,
      })
    : label
}
