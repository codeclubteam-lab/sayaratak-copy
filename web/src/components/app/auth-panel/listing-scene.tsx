import { EyeIcon, HeartIcon, PhoneIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatNumber, formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { usePrefs } from "@/lib/prefs"
import { floatCard, mainCard } from "./styles"

const week = [18, 26, 21, 34, 29, 41, 37]

// A featured listing with its numbers, and its contacts per day floating over it.
export function ListingScene() {
  const { t, locale } = useT()
  const { dataSaver } = usePrefs()
  const price = formatPrice(31500000, locale)
  const stats = [
    { icon: EyeIcon, label: "auth.scene_views", value: 1284 },
    { icon: PhoneIcon, label: "auth.scene_calls", value: 46 },
    { icon: HeartIcon, label: "auth.scene_saves", value: 32 },
  ]
  return (
    <>
      <div className={`${mainCard} flex flex-col gap-4`}>
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-muted">
          {!dataSaver && (
            <img
              src="/images/categories/cars-640.webp"
              width={640}
              height={480}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          )}
          <Badge variant="signal" className="absolute start-3 top-3">
            {t("auth.scene_featured")}
          </Badge>
        </div>
        <div>
          <p className="text-title font-semibold">
            <bdi>{t("auth.scene_listing_title")}</bdi>
          </p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-title font-semibold num">{price.amount}</span>
            <span className="text-ui text-muted-foreground">{price.unit}</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                <s.icon aria-hidden className="size-3.5" />
                {t(s.label)}
              </span>
              <span className="text-ui font-semibold num">
                {formatNumber(s.value, locale)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={`${floatCard} start-80 top-40 w-64`}>
        <p className="text-ui font-semibold">{t("auth.scene_contacts_week")}</p>
        <div className="mt-4 flex h-24 items-end gap-2">
          {week.map((v, i) => (
            <div
              key={i}
              className={`flex-1 rounded-lg ${i === week.length - 1 ? "bg-primary" : "bg-primary/25"}`}
              style={{ blockSize: `${(v / 41) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
