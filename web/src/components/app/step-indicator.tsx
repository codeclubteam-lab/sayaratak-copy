import { useT } from "@/lib/i18n/use-t"

// `current` starts at 1.
export function StepIndicator({
  current,
  total,
  labelFromMd = false,
}: {
  current: number
  total: number
  // Onboarding shows only the bar on phones; the text stays for screen readers.
  labelFromMd?: boolean
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-2">
      <p
        className={`text-caption text-muted-foreground ${labelFromMd ? "max-md:sr-only" : ""}`}
      >
        {t("form.step_of", { current, total })}
      </p>
      <ol className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            aria-current={i + 1 === current ? "step" : undefined}
            className={`h-1 flex-1 rounded-full ${i < current ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </ol>
    </div>
  )
}
