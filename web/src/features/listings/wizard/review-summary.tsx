import type { ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import { useT } from "@/lib/i18n/use-t"
import { useStepHref } from "./use-step-href"

// One block of the review: a heading, an Edit link back to its step, and what was entered.
export function SummarySection({
  step,
  title,
  children,
}: {
  step: string
  title: string
  children: ReactNode
}) {
  const { t } = useT()
  const href = useStepHref()
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ui font-medium">{title}</h2>
        <a
          href={href(step)}
          aria-label={t("post.edit_section", { section: title })}
          className={buttonVariants({ variant: "link", size: "sm" })}
        >
          {t("common.edit")}
        </a>
      </div>
      {children}
    </section>
  )
}
