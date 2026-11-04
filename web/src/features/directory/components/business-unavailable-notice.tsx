import { InfoIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { TargetType } from "@sayaratak/shared/schemas/review"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// On the profile of a business whose owner is banned: says it is not taking enquiries (without saying why) and points to the others.
export function BusinessUnavailableNotice({ type }: { type: TargetType }) {
  const { t, locale } = useT()
  return (
    <section
      aria-labelledby="unavailable-title"
      className="flex items-start gap-3 rounded-xl bg-muted p-4 sm:p-6"
    >
      <InfoIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <h2 id="unavailable-title" className="text-body font-semibold">
          {t("directory.unavailable_title")}
        </h2>
        <p className="text-body">{t(`directory.unavailable_body_${type}`)}</p>
        <a
          href={localeHref(`/${type}s`, locale)}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t(`directory.unavailable_browse_${type}`)}
        </a>
      </div>
    </section>
  )
}
