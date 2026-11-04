import { useState, type KeyboardEvent } from "react"

const storageKey = "sy_review_shortcuts"
type Action = "next" | "prev" | "approve" | "reject"
const actions = new Map<string, Action>([
  ["KeyJ", "next"],
  ["KeyK", "prev"],
  ["KeyA", "approve"],
  ["KeyR", "reject"],
])

// The admin's on or off choice, kept in this browser only. Storage can throw (private mode), so shortcuts then stay on for the visit.
export function useShortcutsOn() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "off"
    } catch {
      return true
    }
  })
  const set = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(storageKey, next ? "on" : "off")
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  }
  return [on, set] as const
}

// J, K, A and R for the element that wraps the queue and the review pane (WCAG 2.1.4: scoped to that focus, can be turned off). Matches `event.code`, so an Arabic layout works too. Typing fields, dialogs and menus keep their keys.
export function reviewKeyHandler(on: boolean, run: (action: Action) => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (!on || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return
    const action = actions.get(event.code)
    if (!action) return
    if (
      !(event.target instanceof Element) ||
      event.target.closest(
        "input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog], [role=listbox], [role=menu]"
      )
    )
      return
    event.preventDefault()
    run(action)
  }
}
