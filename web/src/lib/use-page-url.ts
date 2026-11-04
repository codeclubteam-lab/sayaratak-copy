import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

// The current page address, empty on the server and during hydration so markup matches.
export const usePageUrl = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.href,
    () => ""
  )
