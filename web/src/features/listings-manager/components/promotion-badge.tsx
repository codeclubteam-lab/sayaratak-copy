import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { useNow } from "@/lib/now"
import type { Listing } from "@sayaratak/shared/schemas/listing"

// The promotion running now, with its end date. Amber stays for paid promotion only (A5).
export function PromotionBadge({ listing }: { listing: Listing }) {
  const { t, locale } = useT()
  const now = useNow()
  const live = listing.promotions
    .filter((p) => Date.parse(p.startsAt) <= now && now < Date.parse(p.endsAt))
    .sort((a, b) => b.endsAt.localeCompare(a.endsAt))[0]
  if (!live) return <span className="text-muted-foreground">-</span>
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="signal">{t(`promotion.name_${live.type}`)}</Badge>
      <span className="text-caption text-muted-foreground">
        {t("manager.promo_until", { date: formatDate(live.endsAt, locale) })}
      </span>
    </div>
  )
}
