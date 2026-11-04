import { useEffect, useState } from "react"
import { useRouterState } from "@tanstack/react-router"

import { useDelayedFlag } from "@/lib/use-delayed-flag"

type Phase = "idle" | "start" | "run" | "end" | "fade"

// What each phase of the bar looks like. It creeps toward 90 % over 8 s and never reaches the end by itself (the one animation allowed to run past 240 ms, A5b).
const phaseClass: Record<Phase, string> = {
  idle: "",
  start: "scale-x-0",
  run: "scale-x-90 transition-transform duration-[8s] ease-out",
  end: "scale-x-100 transition-transform duration-(--dur-fast) ease-(--ease-standard)",
  fade: "scale-x-100 opacity-0 transition-opacity duration-(--dur-fast) ease-(--ease-standard)",
}

// A 2 px bar at the top while a navigation waits. It shows after 150 ms, so fast navigations never flash it. Screen readers get the same news from focus moving to the new page's h1, so it is hidden from them.
export function NavigationProgress() {
  const pending = useRouterState({ select: (s) => s.isLoading })
  const show = useDelayedFlag(pending, { delayMs: 150, minMs: 0 })
  const [phase, setPhase] = useState<Phase>("idle")
  useEffect(() => {
    const timers: number[] = []
    if (show) {
      setPhase("start")
      timers.push(window.setTimeout(() => setPhase("run"), 20))
    } else {
      setPhase((p) => (p === "idle" ? p : "end"))
      timers.push(window.setTimeout(() => setPhase("fade"), 120))
      timers.push(window.setTimeout(() => setPhase("idle"), 240))
    }
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [show])
  if (phase === "idle") return null
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-primary ltr:origin-left rtl:origin-right ${phaseClass[phase]}`}
    />
  )
}
