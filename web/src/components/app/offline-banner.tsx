import { useSyncExternalStore } from "react"

import { useT } from "@/lib/i18n/use-t"

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify)
  window.addEventListener("offline", notify)
  return () => {
    window.removeEventListener("online", notify)
    window.removeEventListener("offline", notify)
  }
}

// The server snapshot is "online", so the first client render matches the server HTML.
export function OfflineBanner() {
  const { t } = useT()
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  )
  if (online) return null
  return (
    <div
      role="status"
      className="bg-foreground px-4 py-2 text-center text-ui text-background"
    >
      {t("error.offline")}
    </div>
  )
}
