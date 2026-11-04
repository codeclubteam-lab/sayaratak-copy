import { MessageCircleIcon, PhoneIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { floatCard, mainCard } from "./styles"

const views = [
  620, 700, 660, 760, 820, 780, 900, 860, 940, 1010, 930, 980, 1080, 1040, 1120,
  1060, 1180, 1240, 1150, 1210, 1300, 1260, 1340, 1420, 1360, 1450, 1510, 1480,
  1560, 1640,
]
const W = 480
const H = 160
const max = Math.max(...views) * 1.1
const line = views
  .map((v, i) => `${(i / (views.length - 1)) * W},${H - (v / max) * H}`)
  .join(" L")

// Views over 30 days as an area chart, with calls and WhatsApp clicks floating over it.
export function ViewsScene() {
  const { t, locale } = useT()
  const stats = [
    { icon: PhoneIcon, label: "auth.scene_calls", value: 3359, share: 0.72 },
    {
      icon: MessageCircleIcon,
      label: "auth.scene_whatsapp",
      value: 2888,
      share: 0.6,
    },
  ]
  return (
    <>
      <div className={mainCard}>
        <p className="text-ui text-muted-foreground">{t("auth.scene_views")}</p>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-page font-semibold num">
            {formatNumber(28144, locale)}
          </span>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-caption font-semibold text-success">
            <bdi>+12%</bdi>
          </span>
        </div>
        <p className="text-caption text-muted-foreground">
          {t("auth.scene_period")}
        </p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-6 h-40 w-full rtl:-scale-x-100"
          preserveAspectRatio="none"
        >
          <path
            d={`M0,${H} L${line} L${W},${H} Z`}
            className="fill-primary/10"
          />
          <path
            d={`M${line}`}
            fill="none"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-primary"
          />
        </svg>
      </div>
      <div className={`${floatCard} start-56 top-64 flex w-72 flex-col gap-4`}>
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-ui">
              <s.icon aria-hidden className="size-4 text-primary" />
              <span className="text-muted-foreground">{t(s.label)}</span>
              <span className="ms-auto font-semibold num">
                {formatNumber(s.value, locale)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ inlineSize: `${s.share * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
