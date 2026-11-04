import type { ReactNode } from "react"
import { GemIcon } from "lucide-react"

import { useT } from "@/lib/i18n/use-t"
import { cn } from "@/lib/utils"

// Icon, the "Your plan" label, the plan name and its badge: the top of every plan summary.
export function PlanHeader({
  name,
  badge,
  size,
  headingId,
  end,
}: {
  name?: string
  badge?: ReactNode
  size: "sm" | "md"
  // Makes the "Your plan" label the section's heading.
  headingId?: string
  end?: ReactNode
}) {
  const { t } = useT()
  const Label = headingId ? "h2" : "p"
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "grid shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground",
          size === "sm" ? "size-9" : "size-11"
        )}
      >
        <GemIcon className={size === "sm" ? "size-4" : "size-5"} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label id={headingId} className="text-caption text-muted-foreground">
          {t("billing.current_title")}
        </Label>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={
              size === "sm"
                ? "text-body font-semibold"
                : "text-title font-semibold"
            }
          >
            {name}
          </span>
          {badge}
        </p>
      </div>
      {end}
    </div>
  )
}
