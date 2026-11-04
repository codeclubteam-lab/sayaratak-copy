import { useQuery } from "@tanstack/react-query"

import { meQuery } from "@/features/auth/me-query"
import { useT } from "@/lib/i18n/use-t"
import { localeHref, postPath } from "@/lib/navigation"
import { buttonVariants } from "@/components/ui/button"

// One sentence and the one primary action. Workshops, mechanics and admins do not post listings, so they never see it.
export function PostBand() {
  const { t, locale } = useT()
  const { data: me = null } = useQuery(meQuery)
  const path = postPath(me?.role)
  if (!path) return null
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl bg-card p-4 md:flex-row md:items-center md:justify-between md:p-6">
      <p className="text-lead">{t("home.post_band")}</p>
      <a
        href={localeHref(path, locale)}
        className={buttonVariants({ size: "lg" })}
      >
        {t("common.post_listing")}
      </a>
    </section>
  )
}
