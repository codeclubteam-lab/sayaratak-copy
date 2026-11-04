import { createContext, useContext, useEffect, useRef } from "react"

import { DialogDescription, DialogTitle } from "@/components/ui/dialog"

// "dialog" inside the auth dialog, where the heading must be the dialog's title and the first view must not autofocus a field (the dialog moves focus itself).
export const AuthMode = createContext<"page" | "dialog">("page")

// Title and one line of help. `autoFocus` moves focus here when a step with no field to type in opens (the success screens), so a screen reader hears it.
export function AuthHeading({
  title,
  helper,
  autoFocus,
}: {
  title: string
  helper?: string
  autoFocus?: boolean
}) {
  const mode = useContext(AuthMode)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (autoFocus) heading.current?.focus()
  }, [autoFocus])
  if (mode === "page")
    return (
      <div className="flex flex-col gap-1">
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-page font-semibold focus-visible:outline-none"
        >
          {title}
        </h1>
        {helper && <p className="text-body text-muted-foreground">{helper}</p>}
      </div>
    )
  return (
    <div className="flex flex-col gap-1">
      <DialogTitle
        ref={heading}
        tabIndex={-1}
        // Token values, not the text-title role: DialogTitle sets text-base, which would win over a role class.
        className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-semibold focus-visible:outline-none"
      >
        {title}
      </DialogTitle>
      {helper && (
        <DialogDescription className="text-[length:var(--text-ui)] leading-[var(--leading-ui)]">
          {helper}
        </DialogDescription>
      )}
    </div>
  )
}
