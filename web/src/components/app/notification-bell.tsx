import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import { dashboardPath, personalHref } from "@/lib/navigation"
import { meQuery } from "@/features/auth/me-query"
import { countsQuery } from "@/features/notifications/counts-query"
import { NotificationPanel } from "@/features/notifications/components/notification-panel"

const buttonClass =
  "relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted md:size-10"

// Signed in: a button that opens the latest notifications, with the unread count (polled every 30 s while the tab is visible). Signed out: a link that asks to sign in first.
export function NotificationBell() {
  const { t, locale } = useT()
  const [open, setOpen] = useState(false)
  const { data: me = null } = useQuery(meQuery)
  const { data: counts } = useQuery({
    ...countsQuery,
    enabled: !!me,
    refetchInterval: 30_000,
  })
  const count = me ? counts?.unreadNotifications : undefined
  const label = count
    ? t("nav.notifications_unread", { count })
    : t("nav.notifications")
  const icon = (
    <>
      <Bell className="size-5" strokeWidth={1.5} aria-hidden="true" />
      {!!count && (
        <span
          aria-hidden="true"
          className="absolute end-0 top-0 min-w-4 rounded-full bg-accent px-1 text-center text-caption text-accent-foreground num"
        >
          {formatNumber(count, locale)}
        </span>
      )}
    </>
  )
  if (!me)
    return (
      <a
        href={personalHref(
          `${dashboardPath(undefined)}/notifications`,
          locale,
          me
        )}
        aria-label={label}
        className={buttonClass}
      >
        {icon}
      </a>
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={label} className={buttonClass}>
        {icon}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={t("notifications.title")}
        className="w-[min(24rem,calc(100vw-1rem))] gap-0 p-0"
      >
        <NotificationPanel role={me.role} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
