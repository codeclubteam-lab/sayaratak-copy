import { RowActions } from "@/components/app/row-actions"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { routeHref, searchRoute } from "@/features/search/landing"
import {
  useDeleteSavedSearch,
  useUpdateSavedSearch,
} from "@/features/search/queries"
import { errorText } from "@/lib/api/error-text"
import { formatDate, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { SavedSearch } from "@sayaratak/shared/schemas/saved-search"
import { FilterSummaryChips } from "./filter-summary-chips"

// One saved search: its name, filters and new-match count, the alerts switch (saves at once), Open and a menu with Rename and Delete.
export function SavedSearchRow({
  search,
  onRename,
}: {
  search: SavedSearch
  onRename: (search: SavedSearch) => void
}) {
  const { t, locale } = useT()
  const update = useUpdateSavedSearch()
  const remove = useDeleteSavedSearch()
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  // Opening clears the new count; the link is a plain anchor so it also opens in a new tab. `cn` merges the transparent base border away, which `buttonVariants` alone leaves on a link.
  const href = localeHref(
    routeHref(searchRoute({ ...search.params, page: 1 })),
    locale
  )
  return (
    <li className="flex flex-col gap-4 rounded-xl bg-card p-4 md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="min-w-0 text-body font-semibold">
            <bdi>{search.name}</bdi>
          </h3>
          {search.newCount > 0 && (
            <Badge variant="primary">
              {t("dashboard.saved_searches_new", {
                n: formatNumber(search.newCount, locale),
              })}
            </Badge>
          )}
        </div>
        <FilterSummaryChips params={search.params} name={search.name} />
        <p className="text-caption text-muted-foreground">
          {t("dashboard.saved_searches_created", {
            date: formatDate(search.createdAt, locale),
          })}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-ui">
          <Switch
            aria-label={t("dashboard.saved_searches_alerts_for", {
              name: search.name,
            })}
            checked={search.alerts}
            onCheckedChange={(alerts) =>
              update.mutate({ id: search.id, alerts }, { onError: fail })
            }
          />
          <span aria-hidden="true">{t("dashboard.saved_searches_alerts")}</span>
        </label>
        <a
          href={href}
          aria-label={t("dashboard.saved_searches_open_for", {
            name: search.name,
          })}
          className={cn(buttonVariants({ variant: "outline" }))}
          onClick={() => {
            if (search.newCount > 0)
              update.mutate({ id: search.id, markSeen: true })
          }}
        >
          {t("dashboard.saved_searches_open")}
        </a>
        <RowActions
          label={search.name}
          actions={[
            {
              key: "rename",
              label: t("dashboard.saved_searches_rename"),
              onSelect: () => onRename(search),
            },
            {
              key: "delete",
              label: t("dashboard.saved_searches_delete"),
              onSelect: () =>
                remove.mutate(search.id, {
                  onSuccess: () =>
                    toast.add({ title: t("toast.search_deleted") }),
                  onError: fail,
                }),
              destructive: {
                title: t("dashboard.saved_searches_delete_title"),
                description: t("dashboard.saved_searches_delete_body", {
                  name: search.name,
                }),
              },
            },
          ]}
        />
      </div>
    </li>
  )
}
