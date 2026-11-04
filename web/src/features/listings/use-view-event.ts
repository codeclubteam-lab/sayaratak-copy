import { useEffect } from "react"

import { useTrackEvent } from "./events"

// One `view` per browser session per listing or business profile. Read in an effect, because sessionStorage does not exist on the server.
export function useViewEvent(targetId: string) {
  const { mutate } = useTrackEvent()
  useEffect(() => {
    const key = `viewed:${targetId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // Storage blocked: count the view on every visit rather than none.
    }
    mutate({ type: "view", targetId })
  }, [targetId, mutate])
}
