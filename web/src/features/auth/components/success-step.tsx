import type { ReactNode } from "react"
import { CircleCheckIcon } from "lucide-react"

import { AuthHeading } from "./auth-heading"

// The end of a code flow: a check, what happened, and one way on. No automatic redirect, so nobody misses it.
export function SuccessStep({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <CircleCheckIcon
        aria-hidden="true"
        className="size-12 text-success"
        strokeWidth={1.5}
      />
      <AuthHeading title={title} helper={text} autoFocus />
      {children}
    </div>
  )
}
