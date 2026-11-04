import { formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { PromotionType } from "@sayaratak/shared/schemas/listing"
import { PromotedBadge } from "./promoted-badge"

// A radio row. The amber badge says the option is paid, as everywhere else.
export function PromotionOption({
  name,
  value,
  type,
  durationDays,
  price,
  selected,
  onSelect,
}: {
  name: string
  value: string
  type: PromotionType
  durationDays: number
  price: number
  selected: boolean
  onSelect: () => void
}) {
  const { t, locale } = useT()
  const { amount, unit } = formatPrice(price, locale)
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-card p-4 has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="size-4 shrink-0 accent-primary"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 text-ui font-medium">
          {t(`promotion.name_${type}`)}
          {type === "featured" && <PromotedBadge />}
        </span>
        <span className="text-caption text-muted-foreground">
          {t(`promotion.effect_${type}`)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-ui font-semibold num">
          {amount}{" "}
          <span className="text-caption font-normal text-muted-foreground">
            {unit}
          </span>
        </span>
        <span className="text-caption text-muted-foreground">
          {type === "bump"
            ? t("promotion.once")
            : t("billing.duration_days", { count: durationDays })}
        </span>
      </span>
    </label>
  )
}
