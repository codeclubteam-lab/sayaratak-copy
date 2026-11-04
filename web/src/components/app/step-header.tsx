import type { ReactNode } from "react"

import { useFocusOnChange } from "@/hooks/use-focus-on-change"

// Takes focus when `step` changes, so a screen reader hears the new step. Not on first render.
export function StepHeader({
  title,
  helper,
  step,
  leading,
}: {
  title: string
  helper?: string
  step: string | number
  // Sits in the title row, so a control that comes and goes never moves the title.
  leading?: ReactNode
}) {
  const heading = useFocusOnChange<HTMLHeadingElement>(step)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-1">
        {leading}
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-page font-semibold focus-visible:outline-none"
        >
          {title}
        </h1>
      </div>
      {helper && <p className="text-body text-muted-foreground">{helper}</p>}
    </div>
  )
}
