import { useQuery } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"

import { PriceText } from "@/components/app/price-text"
import { meQuery } from "@/features/auth/me-query"
import { formatDate, formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { adsQueries } from "../queries"
import type { CampaignForm } from "../schemas"
import { BannerPreview } from "./banner-preview"

// Step 4: the banner, the pages with their weekly prices, the dates and the total. The server prices it again from its own table.
export function ReviewStep() {
  const { t, locale } = useT()
  // Nothing changes on this step, so a snapshot of the form is enough.
  const v = useFormContext<CampaignForm>().getValues()
  const me = useQuery(meQuery).data
  const rows = useQuery(
    adsQueries.pages({ startDate: v.startDate, weeks: v.weeks })
  ).data
  const chosen = (rows ?? []).filter((p) => v.pages.includes(p.id))
  const weeks = v.weeks
  const total = chosen.reduce((sum, p) => sum + p.weeklyPrice, 0) * weeks
  const start = `${v.startDate}T12:00:00.000Z`
  const end = new Date(
    Date.parse(start) + (weeks * 7 - 1) * 86_400_000
  ).toISOString()
  return (
    <div className="flex flex-col gap-6">
      {v.cover && (
        <BannerPreview
          lang={locale}
          imageUrl={v.cover.url}
          eyebrow={me?.fullName ?? ""}
          copy={v.copy[locale]}
        />
      )}
      <dl className="flex flex-col gap-2 rounded-xl bg-card p-5 text-ui">
        {chosen.map((p) => (
          <div key={p.id} className="flex justify-between gap-3">
            <dt>{t(`ads.page_${p.id}`)}</dt>
            <dd className="num">
              {formatPrice(p.weeklyPrice, locale).amount} × {weeks}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border pt-2 text-muted-foreground">
          <dt>{t("ads.dates_label")}</dt>
          <dd>
            {formatDate(start, locale)} – {formatDate(end, locale)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <dt className="font-semibold">{t("ads.total")}</dt>
          <dd>
            <PriceText price={total} size="table" />
          </dd>
        </div>
      </dl>
      <p className="text-caption text-muted-foreground">
        {t("ads.review_note")}
      </p>
    </div>
  )
}
