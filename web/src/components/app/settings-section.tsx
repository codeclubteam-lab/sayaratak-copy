import { useId, type ReactNode } from "react"

// Sections are separated by the 1 px divider A5 allows. Title and help sit above the body on mobile and beside it from lg.
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t py-6 first:border-t-0 lg:grid-cols-[18rem_1fr] lg:gap-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-title font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-ui text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}
