import { useEffect, useRef, useState } from "react"

// True after `flag` has held for `delayMs`, then kept for at least `minMs`, so a skeleton or spinner never flashes (A5b).
export function useDelayedFlag(
  flag: boolean,
  { delayMs = 150, minMs = 300 } = {}
) {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(0)
  useEffect(() => {
    if (flag && !shown) {
      const id = setTimeout(() => {
        shownAt.current = Date.now()
        setShown(true)
      }, delayMs)
      return () => clearTimeout(id)
    }
    if (!flag && shown) {
      const id = setTimeout(
        () => setShown(false),
        Math.max(0, minMs - (Date.now() - shownAt.current))
      )
      return () => clearTimeout(id)
    }
  }, [flag, shown, delayMs, minMs])
  return shown
}
