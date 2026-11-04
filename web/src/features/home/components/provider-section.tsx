import { useId, type ReactNode } from "react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"

// A titled list of provider cards (dealerships, workshops or mechanics): skeleton after 150 ms, an error with retry, and nothing when empty. `href` is a path without the locale.
export function ProviderSection({
  title,
  href,
  linkLabel,
  pending,
  error,
  onRetry,
  items,
  className,
}: {
  title: string
  href: string
  linkLabel: string
  pending: boolean
  error: boolean
  onRetry: () => void
  items: { id: string; node: ReactNode }[]
  className: string
}) {
  const { t, locale } = useT()
  const id = useId()
  const delayed = useDelayedFlag(pending)
  if (pending)
    return delayed ? (
      <div
        role="status"
        aria-label={t("common.loading")}
        className="flex flex-col gap-5"
      >
        <Skeleton className="h-7 w-40" />
        <div className={className}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    ) : null
  if (error)
    return (
      <SectionError
        title={title}
        message={t("home.section_error")}
        hint={t("home.section_error_hint")}
        onRetry={onRetry}
      />
    )
  if (!items.length) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-title font-semibold">
          {title}
        </h2>
        <a
          href={localeHref(href, locale)}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end text-ui font-medium text-primary hover:underline md:min-h-0"
        >
          {linkLabel}
        </a>
      </div>
      <ul className={className}>
        {items.map((item) => (
          <li key={item.id} className="*:h-full">
            {item.node}
          </li>
        ))}
      </ul>
    </section>
  )
}
