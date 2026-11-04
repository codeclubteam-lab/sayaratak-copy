import { useId } from "react"
import { Link } from "@tanstack/react-router"
import { CarIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { MediaImage } from "@/components/app/media-image"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Range } from "@sayaratak/shared/schemas/api"
import type { Analytics } from "@sayaratak/shared/schemas/responses"

const SHOWN = 5

// The five listings with the most views in the period; the analytics page has all ten.
export function TopListingsCard({
  range,
  data,
}: {
  range: Range
  data?: Analytics
}) {
  const { t, locale } = useT()
  const id = useId()
  const rows = data?.topListings.slice(0, SHOWN)
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 rounded-xl bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-body font-semibold">
          {t("analytics.top_title")}
        </h2>
        <Link
          to="/$locale/dealer/analytics"
          params={{ locale }}
          search={{ range }}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("common.see_all")}
        </Link>
      </div>
      {!rows ? (
        <Skeleton className="h-64" aria-hidden="true" />
      ) : !rows.length ? (
        <EmptyState
          icon={CarIcon}
          title={t("analytics.top_empty")}
          action={
            <Link
              to="/$locale/dealer/inventory/new"
              params={{ locale }}
              className={buttonVariants({ variant: "outline" })}
            >
              {t("listing.post")}
            </Link>
          }
          level={3}
          className="py-6"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <MediaImage
                src={row.coverUrl}
                alt=""
                sizes="48px"
                className="size-12 shrink-0 rounded-lg"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  to="/$locale/listing/$slug"
                  params={{ locale, slug: row.slug }}
                  className="truncate text-ui font-medium hover:text-primary"
                >
                  <bdi>{row.title}</bdi>
                </Link>
                <span className="text-caption text-muted-foreground num">
                  {t("dashboard.dealer_top_counts", {
                    views: formatNumber(row.views, locale),
                    contacts: formatNumber(row.contacts, locale),
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
