import type { TFunction } from "i18next"
import type { PromotionPrice } from "@sayaratak/shared/schemas/billing"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// A listing wears the Featured badge while a Featured promotion runs. A bump leaves no badge.
export function isFeatured(promotions: Listing["promotions"], now: number) {
  return promotions.some(
    (p) =>
      p.type === "featured" &&
      Date.parse(p.startsAt) <= now &&
      now < Date.parse(p.endsAt)
  )
}

// "Featured, 7 days" or "Bump up": tells the price rows apart in labels and titles.
export function promotionLabel(
  t: TFunction,
  p: Pick<PromotionPrice, "type" | "durationDays">
) {
  const name = t(`promotion.name_${p.type}`)
  return p.type === "bump"
    ? name
    : `${name}, ${t("billing.duration_days", { count: p.durationDays })}`
}
