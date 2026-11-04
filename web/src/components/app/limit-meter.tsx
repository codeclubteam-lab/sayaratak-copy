import type { ReactNode } from "react"

import { useT } from "@/lib/i18n/use-t"
import { UsageMeter } from "./usage-meter"

// The meter plus a message once the cap is hit. `action` is the upgrade link or button.
export function LimitMeter({
  label,
  used,
  limit,
  action,
}: {
  label: string
  used: number
  limit: number | null
  action?: ReactNode
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-2">
      <UsageMeter label={label} used={used} limit={limit} />
      {limit !== null && used >= limit && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="status" className="text-caption text-warning">
            {t("billing.limit_reached")}
          </p>
          {action}
        </div>
      )}
    </div>
  )
}
