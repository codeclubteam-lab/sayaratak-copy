import { useEffect, useState } from "react"

// True while the sentinel element is outside the viewport. Sticky bars use it to show their 1 px line only when content passes under them, without a scroll listener (A5b).
export function useSentinel<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (!node) return
    const observer = new IntersectionObserver(([entry]) =>
      setHidden(!entry?.isIntersecting)
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, hidden] as const
}
