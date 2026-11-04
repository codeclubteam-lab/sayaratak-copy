import type { ReactNode } from "react"

// Title at the start, actions at the end. Pages pass the count already formatted, so it can sit in the heading.
export function PageHeader({
  title,
  count,
  hint,
  headingId,
  children,
}: {
  title: string
  count?: string
  hint?: string
  // Set by pages whose pagination moves focus back to the heading.
  headingId?: string
  children?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="text-page font-semibold outline-none"
        >
          {title}
          {count && (
            <span className="ms-2 text-muted-foreground num">({count})</span>
          )}
        </h1>
        {hint && <p className="text-ui text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  )
}
