import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router"
import { BellIcon, BellOffIcon } from "lucide-react"

import { EmptyState } from "@/components/app/empty-state"
import { PageHeader } from "@/components/app/page-header"
import { resultsHeadingId } from "@/components/app/results-header"
import { ResultsPagination } from "@/components/app/results-pagination"
import { SettingsSection } from "@/components/app/settings-section"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePageTitle } from "@/features/dashboard/components/page-title"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import { countsQuery } from "../counts-query"
import { notificationQueries, useMarkNotificationsRead } from "../queries"
import {
  notificationsSearchSchema,
  pruneNotificationsSearch,
  type NotificationsSearch,
} from "../schemas"
import { useOpenNotification } from "../use-open-notification"
import { NotificationList } from "./notification-list"
import { NotificationPrefsForm } from "./notification-prefs-form"

const PAGE_SIZE = 20

// The bell's page, the same in all five dashboards: tabs All | Unread and the page number in the URL, then the settings.
export function NotificationsPage() {
  const { t, locale } = useT()
  const search = notificationsSearchSchema.parse(useSearch({ strict: false }))
  const pathname = useLocation({ select: (l) => l.pathname })
  const navigate = useNavigate()
  const title = t("notifications.title")
  usePageTitle(title)
  const { tab, page } = search
  const list = useQuery(
    notificationQueries.list({
      unread: tab === "unread" || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
  )
  const unread = useQuery(countsQuery).data?.unreadNotifications ?? 0
  const markAll = useMarkNotificationsRead()
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  const open = useOpenNotification()
  const go = (next: Partial<NotificationsSearch>, replace: boolean) =>
    void navigate({
      to: ".",
      search: pruneNotificationsSearch({ ...search, ...next }),
      replace,
      resetScroll: false,
      viewTransition: false,
    })
  const hrefFor = (p: number) => {
    const query = new URLSearchParams(
      Object.entries(pruneNotificationsSearch({ ...search, page: p })).map(
        ([k, v]) => [k, String(v)]
      )
    ).toString()
    return localeHref(`${pathname}${query && `?${query}`}`, locale)
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} headingId={resultsHeadingId}>
        <Button
          type="button"
          variant="outline"
          disabled={!unread}
          onClick={() => markAll.mutate(undefined, { onError: fail })}
        >
          {t("notifications.mark_all")}
        </Button>
      </PageHeader>
      <Tabs
        value={tab}
        onValueChange={(next) =>
          go({ tab: next === "unread" ? "unread" : "all", page: 1 }, true)
        }
      >
        <TabsList aria-label={t("notifications.tabs_label")}>
          <TabsTrigger value="all">{t("notifications.tab_all")}</TabsTrigger>
          <TabsTrigger value="unread">
            {t("notifications.tab_unread")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4">
          <div className="rounded-xl bg-card p-2" aria-busy={list.isPending}>
            <NotificationList
              items={list.data?.items}
              loading={list.isPending}
              error={list.isError && !list.data}
              onRetry={() => void list.refetch()}
              onOpen={open}
              empty={
                <EmptyState
                  icon={tab === "unread" ? BellOffIcon : BellIcon}
                  title={t(
                    tab === "unread"
                      ? "notifications.empty_unread_title"
                      : "notifications.empty_title"
                  )}
                  body={t(
                    tab === "unread"
                      ? "notifications.empty_unread_body"
                      : "notifications.empty_body"
                  )}
                />
              }
            />
          </div>
          <ResultsPagination
            page={page}
            pageCount={Math.ceil((list.data?.total ?? 0) / PAGE_SIZE)}
            hrefFor={hrefFor}
            onPageChange={(p) => go({ page: p }, false)}
          />
        </TabsContent>
      </Tabs>
      <SettingsSection
        title={t("notifications.settings_title")}
        description={t("notifications.settings_body")}
      >
        <NotificationPrefsForm />
      </SettingsSection>
    </div>
  )
}
