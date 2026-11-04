import type { MouseEvent } from "react"
import { useRouter } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { localeHref } from "@/lib/navigation"
import type { Notification } from "@sayaratak/shared/schemas/messaging"
import { useMarkNotificationsRead } from "./queries"

// A click marks the notification read, then goes to its page without a reload. A modified click (new tab) only marks it. `onDone` closes the bell's panel.
export function useOpenNotification(onDone?: () => void) {
  const router = useRouter()
  const { locale } = useT()
  const { mutate } = useMarkNotificationsRead()
  return (n: Notification, e: MouseEvent) => {
    if (!n.readAt) mutate([n.id])
    onDone?.()
    if (!n.href || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
      return
    e.preventDefault()
    router.history.push(localeHref(n.href, locale))
  }
}
