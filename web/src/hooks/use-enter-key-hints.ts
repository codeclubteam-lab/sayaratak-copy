import { useEffect, type RefObject } from "react"

const fields =
  "input:not([type=hidden], [type=checkbox], [type=radio], [type=file]), textarea"

// Every input under `root` gets enterKeyHint "next", the last one `last`. A textarea keeps Enter for a new line, so it never gets a hint.
export function useEnterKeyHints(
  root: RefObject<HTMLElement | null>,
  last: "next" | "done"
) {
  useEffect(() => {
    const all = [...(root.current?.querySelectorAll(fields) ?? [])]
    all.forEach((el, i) => {
      if (el instanceof HTMLInputElement)
        el.setAttribute("enterkeyhint", i === all.length - 1 ? last : "next")
    })
  })
}
