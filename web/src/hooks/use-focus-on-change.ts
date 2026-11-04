import { useEffect, useRef } from "react"

// A ref for the heading that takes focus when `key` changes, so a screen reader hears the new step. Not on first render.
export function useFocusOnChange<T extends HTMLElement>(key: string | number) {
  const element = useRef<T>(null)
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    element.current?.focus()
  }, [key])
  return element
}
