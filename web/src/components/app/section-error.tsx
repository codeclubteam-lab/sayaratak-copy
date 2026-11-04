import { useId } from "react"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"

// A failed block keeps its title, so the page still reads in order, and offers one retry.
export function SectionError({
  title,
  message,
  hint,
  onRetry,
}: {
  title?: string
  message: string
  hint?: string
  onRetry: () => void
}) {
  const { t } = useT()
  const id = useId()
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className="flex flex-col gap-3"
    >
      {title && (
        <h2 id={id} className="text-title font-semibold">
          {title}
        </h2>
      )}
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl bg-muted px-4 py-6 text-center"
      >
        <TriangleAlertIcon
          aria-hidden
          className="size-6 text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          <p className="text-ui font-medium">{message}</p>
          {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
        </div>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCwIcon data-icon="inline-start" />
          {t("common.retry")}
        </Button>
      </div>
    </section>
  )
}
