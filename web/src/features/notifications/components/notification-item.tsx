import type { MouseEvent } from "react"

import { RelativeTime } from "@/components/app/relative-time"
import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Notification } from "@sayaratak/shared/schemas/messaging"
import { notificationIcon } from "../notification-icon"

// One row: icon by type, title, body, time. A row with a page is a link; one without is a button until it is read, then plain text. The unread dot has a text twin for screen readers. Without `onOpen` (the broadcast preview) it is plain text.
export function NotificationItem({
  notification: n,
  onOpen,
  compact = false,
}: {
  notification: Notification
  onOpen?: (n: Notification, e: MouseEvent) => void
  // The bell's panel keeps the body to one line; the notifications page shows all of it.
  compact?: boolean
}) {
  const { t, locale } = useT()
  const Icon = notificationIcon[n.type]
  const unread = !n.readAt
  const row = "flex min-h-11 w-full items-start gap-3 rounded-lg p-3 text-start"
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span
            className={`flex min-w-0 items-center gap-2 text-ui ${unread ? "font-semibold" : "font-medium"}`}
          >
            {unread && (
              <>
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 self-start rounded-full bg-primary"
                />
                <span className="sr-only">{t("notifications.unread")}</span>
              </>
            )}
            <span className={compact ? "truncate" : "min-w-0 break-words"}>
              {n.title[locale]}
            </span>
          </span>
          <RelativeTime
            iso={n.createdAt}
            className="shrink-0 text-caption text-muted-foreground"
          />
        </span>
        <span
          className={`text-caption text-muted-foreground ${compact ? "truncate" : "break-words whitespace-pre-line"}`}
        >
          {n.body[locale]}
        </span>
      </span>
    </>
  )
  return (
    <li>
      {!onOpen ? (
        <div className={row}>{content}</div>
      ) : n.href ? (
        <a
          href={localeHref(n.href, locale)}
          onClick={(e) => onOpen(n, e)}
          className={`${row} hover:bg-muted`}
        >
          {content}
        </a>
      ) : unread ? (
        <button
          type="button"
          onClick={(e) => onOpen(n, e)}
          className={`${row} hover:bg-muted`}
        >
          {content}
        </button>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  )
}
