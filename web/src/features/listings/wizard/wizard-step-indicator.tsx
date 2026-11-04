import { useT } from "@/lib/i18n/use-t"

// A bar and a label per step. Any step the wizard allows (all earlier ones valid) is a plain link, except the current one.
export function WizardStepIndicator({
  steps,
  current,
  reachable,
  href,
}: {
  steps: { id: string; label: string }[]
  // Indexes, from 0.
  current: number
  reachable: number
  href: (id: string) => string
}) {
  const { t } = useT()
  return (
    <nav aria-label={t("post.steps_label")}>
      <ol className="flex gap-1">
        {steps.map((step, i) => {
          const link = i !== current && i <= reachable
          const bar = (
            <>
              <span
                aria-hidden="true"
                className={`h-1 rounded-full ${i <= current ? "bg-primary" : "bg-muted"}`}
              />
              <span
                className={
                  i === current
                    ? "truncate text-caption font-medium text-foreground"
                    : link
                      ? "truncate text-caption text-foreground"
                      : "truncate text-caption text-muted-foreground"
                }
              >
                {step.label}
              </span>
            </>
          )
          return (
            <li
              key={step.id}
              aria-current={i === current ? "step" : undefined}
              className="min-w-0 flex-1"
            >
              {link ? (
                <a href={href(step.id)} className="flex flex-col gap-2 py-2">
                  {bar}
                </a>
              ) : (
                <span className="flex flex-col gap-2 py-2">{bar}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
