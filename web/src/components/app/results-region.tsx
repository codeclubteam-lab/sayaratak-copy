import type { ReactNode } from "react"

import { useDelayedFlag } from "@/lib/use-delayed-flag"
import { cn } from "@/lib/utils"

// Wraps the cards or rows of a result list. While new results load (`stale`, from `isPlaceholderData`) the old ones stay and dim to 60 % after 150 ms, so the page never jumps (A5b).
export function ResultsRegion({
  stale,
  children,
}: {
  stale: boolean
  children: ReactNode
}) {
  const dimmed = useDelayedFlag(stale, { delayMs: 150, minMs: 0 })
  return (
    <div
      aria-busy={stale}
      className={cn("transition-opacity", dimmed && "opacity-60")}
    >
      {children}
    </div>
  )
}
