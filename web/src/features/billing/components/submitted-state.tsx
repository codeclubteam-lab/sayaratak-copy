import { useEffect, useRef } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"

// Shown after sending and whenever the item already has a payment under review. The heading takes focus, the sentence is announced.
export function SubmittedState({ base }: { base: string }) {
  const { t, locale } = useT()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <section className="flex flex-col items-start gap-3">
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-title font-semibold outline-none"
      >
        {t("billing.submitted_title")}
      </h2>
      <p role="status" className="text-body text-muted-foreground">
        {t("billing.submitted_body")}
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href={localeHref(`${base}/billing?tab=history`, locale)}
          className={buttonVariants()}
        >
          {t("billing.go_history")}
        </a>
        <a
          href={localeHref(base, locale)}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("billing.go_dashboard")}
        </a>
      </div>
    </section>
  )
}
