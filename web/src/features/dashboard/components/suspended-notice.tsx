import { useQuery } from "@tanstack/react-query"
import { CircleAlertIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { businessQueries } from "@/features/directory/queries"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Above every page of a business dashboard while the admin has the business suspended: why, what it means, and the way to support.
export function SuspendedNotice() {
  const { t, locale } = useT()
  const { data } = useQuery(businessQueries.mine)
  if (data?.status !== "suspended") return null
  return (
    <section
      aria-labelledby="suspended-title"
      className="mb-6 flex items-start gap-3 rounded-xl bg-destructive/12 p-4 sm:p-6"
    >
      <CircleAlertIcon
        aria-hidden
        className="mt-0.5 size-5 shrink-0 text-destructive"
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <h2 id="suspended-title" className="text-body font-semibold">
          {t("dashboard.suspended_title")}
        </h2>
        <p className="text-body">{t("dashboard.suspended_body")}</p>
        {data.suspendedReason && (
          <p className="text-body">
            {t("dashboard.suspended_reason", { reason: data.suspendedReason })}
          </p>
        )}
        <a
          href={localeHref("/contact", locale)}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("dashboard.suspended_contact")}
        </a>
      </div>
    </section>
  )
}
