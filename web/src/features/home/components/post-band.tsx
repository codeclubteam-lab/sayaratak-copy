import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"

import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import { localeHref, postPath } from "@/lib/navigation"
import { buttonVariants } from "@/components/ui/button"

export function PostBand() {
  const { t, locale } = useT()
  const { data: me = null } = useQuery(meQuery)
  const path = postPath(me?.role)
  if (!path) return null
  return (
    <section className="relative overflow-hidden rounded-xl bg-card p-6 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-title font-semibold tracking-tight">
            {t("home.post_band_title")}
          </h2>
          <p className="text-body">
            <span className="text-muted-foreground">
              {t("home.post_band_desc")}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
            <span className="inline-flex items-center gap-1.5 text-caption font-medium">
              <Check
                className="size-4 shrink-0 text-primary"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span>{t("home.post_band_commission")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption font-medium">
              <Check
                className="size-4 shrink-0 text-primary"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span>{t("home.post_band_direct")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption font-medium">
              <Check
                className="size-4 shrink-0 text-primary"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span>{t("home.post_band_currency")}</span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <a
            href={localeHref(path, locale)}
            className={buttonVariants({ size: "lg" })}
          >
            {t("common.post_listing")}
          </a>
          <a
            href={localeHref("/search", locale)}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("home.explore_marketplace")}
          </a>
        </div>
      </div>
    </section>
  )
}
