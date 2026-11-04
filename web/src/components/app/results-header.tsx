import type { ReactNode } from "react"

import { useT } from "@/lib/i18n/use-t"

export const resultsHeadingId = "results-heading"

// Title and result count on one side, controls (filter trigger, sort, save) on the other.
export function ResultsHeader({
  title,
  total,
  as: Heading = "h1",
  icon,
  children,
}: {
  title: string
  total?: number
  // A profile tab has its own h1 above, so its results heading is an h2.
  as?: "h1" | "h2"
  // Decorative mark before the title (the make's logo on a make search).
  icon?: ReactNode
  children?: ReactNode
}) {
  const { t } = useT()
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-3">
          {icon}
          <Heading
            id={resultsHeadingId}
            tabIndex={-1}
            className={`${Heading === "h1" ? "text-page" : "text-title"} font-semibold outline-none`}
          >
            {title}
          </Heading>
        </div>
        <p aria-live="polite" className="text-ui text-muted-foreground num">
          {total === undefined
            ? ""
            : t("search.results_count", { count: total })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
