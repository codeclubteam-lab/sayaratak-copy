import type { ReactNode } from "react"

import { useT } from "@/lib/i18n/use-t"
import { Button } from "@/components/ui/button"

// Shown above the table while rows are selected. Actions come from the page, so each one can confirm and mutate on its own.
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: ReactNode
}) {
  const { t } = useT()
  return (
    <div
      role="region"
      aria-label={t("table.bulk_actions")}
      className="flex flex-wrap items-center gap-3 rounded-xl bg-accent p-3 text-accent-foreground"
    >
      <p aria-live="polite" className="text-ui font-medium num">
        {t("table.selected", { count })}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
      <Button
        type="button"
        variant="ghost"
        className="ms-auto"
        onClick={onClear}
      >
        {t("table.clear_selection")}
      </Button>
    </div>
  )
}
