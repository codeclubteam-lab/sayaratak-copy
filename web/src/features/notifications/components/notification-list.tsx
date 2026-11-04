import type { MouseEvent, ReactNode } from "react"

import { SectionError } from "@/components/app/section-error"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/lib/i18n/use-t"
import { useDelayedFlag } from "@/lib/use-delayed-flag"
import type { Notification } from "@sayaratak/shared/schemas/messaging"
import { NotificationItem } from "./notification-item"

// The list with its three other states: loading skeleton (only if slow), error with Retry (only when nothing is loaded), and the caller's empty block.
export function NotificationList({
  items,
  loading,
  error,
  onRetry,
  onOpen,
  empty,
  compact = false,
}: {
  items: Notification[] | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpen: (n: Notification, e: MouseEvent) => void
  empty: ReactNode
  compact?: boolean
}) {
  const { t } = useT()
  const skeleton = useDelayedFlag(loading)
  if (error)
    return <SectionError message={t("notifications.error")} onRetry={onRetry} />
  if (loading)
    return skeleton ? (
      <ul aria-hidden="true" className="flex flex-col">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex gap-3 p-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </li>
        ))}
      </ul>
    ) : null
  if (!items?.length) return empty
  return (
    <ul aria-label={t("notifications.list_label")} className="flex flex-col">
      {items.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onOpen={onOpen}
          compact={compact}
        />
      ))}
    </ul>
  )
}
