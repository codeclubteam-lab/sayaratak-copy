import type { ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"

// A heading that opens and closes its fields. A native <details>, so keyboard and screen readers work without script; `focusFirstInvalid` opens it when a field inside has an error. `summary` is a short note at the end of the heading ("3 of 9 filled").
export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex min-h-(--control-h) cursor-pointer list-none items-center gap-2 rounded-lg bg-(--field) px-3 text-ui font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-(--dur-fast) ease-(--ease-standard) group-open:rotate-180"
        />
        <span>{title}</span>
        {summary && (
          <span className="ms-auto text-caption font-normal text-muted-foreground">
            {summary}
          </span>
        )}
      </summary>
      <div className="py-4">{children}</div>
    </details>
  )
}
