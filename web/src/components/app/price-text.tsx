import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import type { Listing } from "@sayaratak/shared/schemas/listing"

const sizes = {
  card: "text-title",
  detail: "text-[1.75rem] leading-9",
  table: "text-ui",
}

// The amount takes the context size, the unit and rent period stay at caption size.
export function PriceText({
  price,
  period = null,
  size = "card",
  className,
}: {
  price: number
  period?: Listing["rentPeriod"]
  size?: keyof typeof sizes
  className?: string
}) {
  const { t, locale } = useT()
  const { amount, unit } = formatPrice(price, locale)
  return (
    <span
      className={cn("inline-flex flex-wrap items-baseline gap-x-1", className)}
    >
      <span className={`${sizes[size]} font-semibold num`}>{amount}</span>
      <span className="text-caption text-muted-foreground">{unit}</span>
      {period && (
        <span className="text-caption text-muted-foreground">
          {t(`listing.per_${period}`)}
        </span>
      )}
    </span>
  )
}
