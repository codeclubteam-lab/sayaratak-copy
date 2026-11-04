import { CheckIcon, CircleCheckIcon } from "lucide-react"

import { formatNumber, formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { floatCard, mainCard } from "./styles"

const features = [
  "auth.scene_plan_f1",
  "auth.scene_plan_f2",
  "auth.scene_plan_f3",
]

// A plan card with its listing meter, and an approved Bankak payment floating over it.
export function PlanScene() {
  const { t, locale } = useT()
  const price = formatPrice(250000, locale)
  return (
    <>
      <div className={`${mainCard} flex flex-col gap-5`}>
        <div>
          <p className="text-ui text-muted-foreground">
            {t("auth.scene_plan_caption")}
          </p>
          <p className="text-title font-semibold">
            {t("auth.scene_plan_name")}
          </p>
        </div>
        <p className="flex items-baseline gap-1.5">
          <span className="text-page font-semibold num">{price.amount}</span>
          <span className="text-ui text-muted-foreground">
            {price.unit} {t("auth.scene_per_month")}
          </span>
        </p>
        <ul className="flex flex-col gap-2.5 text-ui">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckIcon aria-hidden className="size-3.5" />
              </span>
              {t(f)}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <div className="flex justify-between text-ui">
            <span className="text-muted-foreground">
              {t("auth.scene_listings_used")}
            </span>
            <span className="font-semibold num">
              {formatNumber(128, locale)} / {formatNumber(200, locale)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full w-[64%] rounded-full bg-primary" />
          </div>
        </div>
      </div>
      <div
        className={`${floatCard} start-64 top-80 flex w-88 items-center gap-3`}
      >
        <CircleCheckIcon aria-hidden className="size-9 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-ui font-semibold">{t("auth.scene_paid")}</p>
          <p className="text-caption text-muted-foreground">
            {t("auth.scene_paid_via")} · <bdi>SY-527294</bdi>
          </p>
        </div>
        <span className="ms-auto text-ui font-semibold num">
          {price.amount}
        </span>
      </div>
    </>
  )
}
