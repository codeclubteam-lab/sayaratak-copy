import { useId, type ReactNode } from "react"
import { CarIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { EmptyState } from "./empty-state"
import { ListingCard } from "./listing-card"

// Sideways scroll-snap row on mobile, four columns from lg. `href` is a path without the locale.
// `action` sits beside the title; `empty` replaces the row when there are no cards; `eager` is how many first photos load at once.
export function ListingRail({
  title,
  href,
  listings,
  action,
  empty,
  eager = 0,
}: {
  title: string
  href?: string
  listings: Listing[]
  action?: ReactNode
  empty?: string
  // How many of the first cards load their photo at once (no fade).
  eager?: number
}) {
  const { t, locale } = useT()
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={id} className="text-title font-semibold">
          {title}
        </h2>
        {action}
        {href && (
          <a
            href={localeHref(href, locale)}
            className="ms-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-end text-ui font-medium text-primary hover:underline md:min-h-0"
          >
            {t("common.see_all")}
          </a>
        )}
      </div>
      {listings.length === 0 ? (
        <EmptyState
          icon={CarIcon}
          title={empty ?? ""}
          level={3}
          className="py-6"
        />
      ) : (
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          {listings.map((listing, i) => (
            <li key={listing.id} className="w-60 shrink-0 snap-start lg:w-auto">
              <ListingCard listing={listing} priority={i < eager} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
