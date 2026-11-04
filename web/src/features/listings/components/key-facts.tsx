import type { Spec } from "@/components/app/specs-list"

// Four to six values in a row, label above value, no lines between them.
export function KeyFacts({ items }: { items: Spec[] }) {
  if (!items.length) return null
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3">
      {items.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-caption text-muted-foreground">{label}</dt>
          <dd className="text-body font-medium num">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
