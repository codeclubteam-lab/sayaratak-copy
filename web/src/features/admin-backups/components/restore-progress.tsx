import { useEffect, useId, useState } from "react"

import { useT } from "@/lib/i18n/use-t"
import { Progress } from "@/components/ui/progress"

// ponytail: the mock restores in about 1.5 s and reports no progress, so the bar fills on a timer and holds at 90%
// until the answer comes. A real API that reports progress replaces the timer.
const EXPECTED_MS = 1500

export function RestoreProgress() {
  const { t } = useT()
  const id = useId()
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const timer = window.setInterval(
      () => setValue(Math.min(90, ((Date.now() - start) / EXPECTED_MS) * 90)),
      50
    )
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="flex flex-col gap-3">
      <p id={id} className="text-ui font-medium">
        {t("admin.backup_restoring_text")}
      </p>
      <Progress value={Math.round(value)} aria-labelledby={id} />
      <p className="text-ui text-muted-foreground">
        {t("admin.backup_restoring_hint")}
      </p>
    </div>
  )
}
