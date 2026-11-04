import { useEffect, useState } from "react"

// Seconds left, counting down once a second; `set` restarts it.
export function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial)
  useEffect(() => {
    if (seconds <= 0) return
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [seconds])
  return [seconds, setSeconds] as const
}
