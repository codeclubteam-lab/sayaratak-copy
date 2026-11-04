import { useQuery } from "@tanstack/react-query"

import { buttonVariants, Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { errorText } from "@/lib/api/error-text"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, localeHref } from "@/lib/navigation"
import type { User } from "@sayaratak/shared/schemas/user"
import { countsQuery } from "../counts-query"
import { notificationQueries, useMarkNotificationsRead } from "../queries"
import { useOpenNotification } from "../use-open-notification"
import { NotificationList } from "./notification-list"

// The bell's popover: the latest 8, "Mark all as read", and a link to the page. Clicking a row closes the panel.
export function NotificationPanel({
  role,
  onClose,
}: {
  role: User["role"]
  onClose: () => void
}) {
  const { t, locale } = useT()
  const list = useQuery(notificationQueries.list({ pageSize: 8 }))
  const unread = useQuery(countsQuery).data?.unreadNotifications ?? 0
  const markAll = useMarkNotificationsRead()
  const fail = (error: unknown) => toast.add({ title: errorText(t, error) })
  const open = useOpenNotification(onClose)
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        <h2 className="text-ui font-semibold">{t("notifications.title")}</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 md:min-h-0"
          disabled={!unread}
          onClick={() => markAll.mutate(undefined, { onError: fail })}
        >
          {t("notifications.mark_all")}
        </Button>
      </div>
      <div className="max-h-[min(24rem,60dvh)] overflow-y-auto overscroll-contain px-1">
        <NotificationList
          compact
          items={list.data?.items}
          loading={list.isPending}
          error={list.isError && !list.data}
          onRetry={() => void list.refetch()}
          onOpen={open}
          empty={
            <p className="px-3 py-6 text-center text-ui text-muted-foreground">
              {t("notifications.empty_title")}
            </p>
          }
        />
      </div>
      <a
        href={localeHref(`${dashboardPath(role)}/notifications`, locale)}
        onClick={onClose}
        className={`${buttonVariants({ variant: "ghost" })} m-1`}
      >
        {t("notifications.see_all")}
      </a>
    </div>
  )
}
