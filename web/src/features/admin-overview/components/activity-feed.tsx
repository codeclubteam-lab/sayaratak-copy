import { useQuery } from "@tanstack/react-query"
import { ActivityIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { RelativeTime } from "@/components/app/relative-time"
import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { adminQueries } from "@/features/admin/queries"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"

// The ten newest events on the site; each row opens its admin screen with the item selected.
export function ActivityFeed() {
  const { t, locale } = useT()
  const activity = useQuery(adminQueries.activity)
  const items = activity.data?.items
  return (
    <section
      aria-labelledby="admin-activity"
      className="flex flex-col gap-2 rounded-xl bg-card p-5"
    >
      <h2 id="admin-activity" className="text-body font-semibold">
        {t("dashboard.overview_activity_title")}
      </h2>
      {activity.isError ? (
        <SectionError
          message={t("admin.activity_error")}
          onRetry={() => void activity.refetch()}
        />
      ) : !items ? (
        <div aria-hidden="true" className="flex flex-col gap-3 py-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          level={3}
          icon={ActivityIcon}
          title={t("admin.activity_empty")}
          className="py-6"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <a
                href={localeHref(item.href, locale)}
                className="flex flex-col gap-0.5 rounded-lg px-2 py-3 motion-color hover:bg-muted"
              >
                <span className="text-ui">
                  {t(`admin.activity_${item.type}`, {
                    label: `⁨${item.label[locale]}⁩`,
                  })}
                </span>
                <RelativeTime
                  iso={item.createdAt}
                  className="text-caption text-muted-foreground"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
