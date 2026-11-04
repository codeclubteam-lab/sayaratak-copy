import { useQueries } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { formatDate } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"
import { adminQueries } from "@/features/admin/queries"
import type { SitePage } from "@sayaratak/shared/schemas/admin"
import { Skeleton } from "@/components/ui/skeleton"
import { pageSlugs } from "../schemas"

// One link per page with its last save; the open one has the accent background. Two columns on a phone, one beside the editor from lg.
export function PageList({ current }: { current: SitePage["slug"] }) {
  const { t, locale } = useT()
  const pages = useQueries({
    queries: pageSlugs.map((slug) => adminQueries.page(slug)),
  })
  return (
    <nav aria-label={t("dashboard.nav_pages")}>
      <ul className="grid grid-cols-2 gap-1 rounded-xl bg-card p-2 lg:grid-cols-1">
        {pageSlugs.map((slug, i) => {
          const updatedAt = pages[i]?.data?.updatedAt
          return (
            <li key={slug}>
              <Link
                to="."
                search={{ page: slug }}
                aria-current={slug === current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col justify-center gap-0.5 rounded-lg px-3 py-2 motion-color",
                  slug === current
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                <span className="text-ui font-medium">{t(`nav.${slug}`)}</span>
                {updatedAt ? (
                  <span className="text-caption text-muted-foreground">
                    {t("admin.pages_updated", {
                      date: formatDate(updatedAt, locale),
                    })}
                  </span>
                ) : (
                  <Skeleton className="h-3 w-24" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
