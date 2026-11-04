import type { ReactNode } from "react"

export type Spec = { label: string; value: ReactNode }

// A definition list, on two columns once the list itself is 32rem wide (not the viewport: a side sheet is narrow on any screen). Values that can hold Latin text next to Arabic (makes, models) are wrapped in <bdi> by the caller. A long unbroken value (a chassis number) wraps instead of spilling out.
export function SpecsList({ items }: { items: Spec[] }) {
  return (
    <div className="@container">
      <dl className="grid gap-x-8 gap-y-3 @lg:grid-cols-2">
        {items.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 @lg:justify-start"
          >
            <dt className="w-32 shrink-0 text-ui text-muted-foreground">
              {label}
            </dt>
            <dd className="min-w-0 text-ui font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
